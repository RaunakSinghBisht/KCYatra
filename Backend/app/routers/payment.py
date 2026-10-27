"""
routers/payment.py — Razorpay order creation, verification and webhook.

Flow:
  1. POST /payments/create-order  { registration_ids }
       - Prices are derived ENTIRELY server-side: package titles are looked up in the
         yatra's package catalogue (never trusting the price text stored on a registration),
         then the age-based fare rule is applied.
       - A PaymentOrder row is stored, binding the Razorpay order to those registrations
         and the exact amounts.
  2. Frontend opens Razorpay checkout.
  3. POST /payments/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
       - Verifies the HMAC signature, then marks exactly the registrations bound to that
         order as paid (idempotent, row-locked, single transaction).
  4. POST /payments/webhook  — Razorpay → server. Reconciles payments even if the browser
       closed before step 3 (payment.captured / order.paid).

Age-based fare rules (age = yatra start_date year − passenger year_of_birth):
  0–5 inclusive  → ₹0 (Free)
  6–10 inclusive → half of (hotel + travel package price)
  11+            → full price
"""

import asyncio
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import Principal, require_user
from app.dependencies.db import get_db
from app.models.passenger import Passenger
from app.models.payment_order import PaymentOrder
from app.models.registration import Registration
from app.models.yatra import Yatra

logger = logging.getLogger("kcyatra")

router = APIRouter(prefix="/payments", tags=["Payments"])

MAX_REGISTRATIONS_PER_ORDER = 20
MIN_ORDER_PAISE = 100  # Razorpay rejects orders below ₹1.00
RAZORPAY_TIMEOUT_SECONDS = 15
FREE_ORDER_PREFIX = "FREE_"
FREE_PAYMENT_ID = "FREE_PAYMENT"

# "Pay by Cash" bookings pay this share online up front; the rest is collected in cash.
CASH_ADVANCE_PERCENT = Decimal("0.20")
STATUS_PAID = "paid"
STATUS_PARTIAL = "partial_paid"
# Registrations in these states take no further online payment.
NO_ONLINE_PAYMENT_STATUSES = {STATUS_PAID, STATUS_PARTIAL}


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    registration_ids: list[int] = Field(min_length=1, max_length=MAX_REGISTRATIONS_PER_ORDER)
    # "full"         → pay the whole fare online
    # "cash_partial" → pay 20% online now; the rest is paid in cash
    mode: Literal["full", "cash_partial"] = "full"


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int          # paise (INR × 100)
    currency: str
    key_id: str          # Razorpay public key — safe to expose to frontend
    is_free: bool = False


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=64)
    razorpay_payment_id: str = Field(min_length=1, max_length=64)
    razorpay_signature: str = Field(min_length=1, max_length=256)


class ConfirmFreeRequest(BaseModel):
    order_id: str = Field(min_length=1, max_length=64)


class VerifyPaymentResponse(BaseModel):
    success: bool
    message: str
    paid_registration_ids: list[int]
    # Registrations that paid 20% online; the remainder is due in cash.
    partial_registration_ids: list[int] = []


# ── Helpers ───────────────────────────────────────────────────────────────────

def _razorpay_client() -> razorpay.Client:
    if not settings.RAZORPAY_API_KEY or not settings.RAZORPAY_API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway not configured. Contact support.",
        )
    return razorpay.Client(
        auth=(settings.RAZORPAY_API_KEY, settings.RAZORPAY_API_SECRET)
    )


def _hmac_sha256_hex(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def _verify_checkout_signature(order_id: str, payment_id: str, signature: str) -> bool:
    expected = _hmac_sha256_hex(settings.RAZORPAY_API_SECRET, f"{order_id}|{payment_id}".encode())
    return hmac.compare_digest(expected, signature)


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _catalog_price(selected: str | None, catalog: list | None, label: str) -> Decimal:
    """
    Resolve a registration's stored package ("Title : Price" or just "Title") against the
    yatra's package catalogue. Only the TITLE is taken from the registration — the price
    always comes from the catalogue, so a tampered price string cannot lower the amount.
    """
    if not selected:
        if catalog:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{label} package not selected.",
            )
        return Decimal("0")

    idx = selected.rfind(" : ")
    title = (selected[:idx] if idx != -1 else selected).strip()
    for pkg in catalog or []:
        if isinstance(pkg, dict) and str(pkg.get("title", "")).strip() == title:
            return Decimal(str(pkg.get("price", 0)))

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"{label} package '{title}' is no longer available.",
    )


def _fare(base_amount: Decimal, age: int) -> Decimal:
    if age <= 5:
        return Decimal("0")
    if age <= 10:
        return _quantize(base_amount / 2)
    return _quantize(base_amount)


def _advance_paise(full_paise: int) -> int:
    """20% of a fare, rounded to the nearest paisa."""
    return int((Decimal(full_paise) * CASH_ADVANCE_PERCENT).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


async def _build_items(
    db: AsyncSession, registration_ids: list[int], user_id: int, *, partial: bool = False
) -> list[dict]:
    """
    Validate each registration and compute what to charge now (in paise) from DB data only.
    Item: {"registration_id", "amount_paise" (charged in this order), "full_paise" (whole fare), "partial"}.
    Rejects unknown, other users', already-paid / 20%-paid, or closed-yatra registrations.
    """
    ids = list(dict.fromkeys(registration_ids))  # de-duplicate, keep order
    rows = (
        await db.execute(
            select(Registration, Passenger, Yatra)
            .join(Passenger, Registration.passenger_id == Passenger.id)
            .join(Yatra, Registration.yatra_id == Yatra.id)
            .where(Registration.id.in_(ids))
        )
    ).all()
    found = {reg.id: (reg, pax, yatra) for reg, pax, yatra in rows}

    items: list[dict] = []
    for reg_id in ids:
        entry = found.get(reg_id)
        if not entry or entry[2].is_deleted or entry[0].user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Registration {reg_id} not found.",
            )
        reg, pax, yatra = entry

        if reg.payment_status == STATUS_PAID:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Registration {reg_id} is already paid.",
            )
        if reg.payment_status == STATUS_PARTIAL:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="20% has already been paid online for this passenger. The remaining amount is to be paid in cash.",
            )
        if yatra.status != "open":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registrations for this yatra are not open.",
            )

        base = _catalog_price(reg.hotel_package, yatra.hotel_packages, "Hotel") + _catalog_price(
            reg.travel_package, yatra.travel_packages, "Travel"
        )
        age = yatra.start_date.year - pax.year_of_birth
        full_paise = int(_fare(base, age) * 100)
        items.append(
            {
                "registration_id": reg.id,
                "amount_paise": _advance_paise(full_paise) if partial else full_paise,
                "full_paise": full_paise,
                "partial": partial,
            }
        )

    return items


async def _create_razorpay_order(amount_paise: int, receipt: str, notes: dict[str, str]) -> dict:
    """The Razorpay SDK is blocking — run it off the event loop with a hard timeout."""
    client = _razorpay_client()
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(
                client.order.create,
                {
                    "amount": amount_paise,
                    "currency": "INR",
                    "receipt": receipt,
                    "notes": notes,
                    "payment_capture": 1,  # auto-capture on success
                },
            ),
            timeout=RAZORPAY_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.error("[Payment] Razorpay order creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create payment order. Please try again.",
        ) from exc


async def _get_order_locked(db: AsyncSession, razorpay_order_id: str) -> PaymentOrder | None:
    """Row-lock the order so verify and webhook can never double-process it."""
    return await db.scalar(
        select(PaymentOrder)
        .where(PaymentOrder.razorpay_order_id == razorpay_order_id)
        .with_for_update()
    )


def _order_registration_ids(order: PaymentOrder) -> list[int]:
    return [int(item["registration_id"]) for item in order.items]


def _is_partial_item(item: dict) -> bool:
    """A 20%-advance item with something left to collect in cash (a ₹0 fare has nothing left, so it counts as paid)."""
    return bool(item.get("partial")) and int(item.get("full_paise", 0)) > 0


def _split_ids(order: PaymentOrder) -> tuple[list[int], list[int]]:
    paid = [int(i["registration_id"]) for i in order.items if not _is_partial_item(i)]
    partial = [int(i["registration_id"]) for i in order.items if _is_partial_item(i)]
    return paid, partial


async def _mark_order_paid(
    db: AsyncSession, order: PaymentOrder, payment_id: str
) -> tuple[list[int], list[int]]:
    """
    Record the order's payment on every registration bound to it, atomically.
    Returns (fully-paid ids, 20%-paid ids). A full payment sets "paid"/"online"; a 20% advance sets
    "partial_paid"/"cash" (the rest is collected in cash). Caller must hold the order row lock.
    Idempotent — an already-processed order is a no-op.
    """
    if order.status == "paid":
        return _split_ids(order)

    ids = _order_registration_ids(order)
    regs = (
        await db.execute(
            select(Registration).where(Registration.id.in_(ids)).with_for_update()
        )
    ).scalars().all()
    by_id = {reg.id: reg for reg in regs}

    paid_ids: list[int] = []
    partial_ids: list[int] = []
    for item in order.items:
        reg = by_id.get(int(item["registration_id"]))
        if reg is None:
            logger.warning("[Payment] Registration %s vanished before payment %s", item["registration_id"], payment_id)
            continue
        if reg.payment_status in NO_ONLINE_PAYMENT_STATUSES and reg.transaction_id != payment_id:
            # Already settled via a different order — customer was charged twice; needs a manual refund.
            logger.error(
                "[Payment] DUPLICATE PAYMENT registration=%d already %s (txn=%s); new payment=%s needs refund",
                reg.id, reg.payment_status, reg.transaction_id, payment_id,
            )
            continue
        reg.amount_paid = _quantize(Decimal(item["amount_paise"]) / Decimal(100))  # type: ignore[assignment]
        reg.transaction_id = payment_id
        if _is_partial_item(item):
            reg.payment_status = STATUS_PARTIAL
            reg.payment_method = "cash"
            partial_ids.append(reg.id)
        else:
            reg.payment_status = STATUS_PAID
            reg.payment_method = "online"
            paid_ids.append(reg.id)

    order.status = "paid"
    order.razorpay_payment_id = payment_id
    order.paid_at = datetime.now(timezone.utc)
    await db.commit()

    logger.info(
        "[Payment] Order %s processed payment=%s paid=%s partial=%s",
        order.razorpay_order_id, payment_id, paid_ids, partial_ids,
    )
    return paid_ids, partial_ids


# ── POST /payments/create-order ───────────────────────────────────────────────

@router.post(
    "/create-order",
    response_model=CreateOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Razorpay order for the selected registrations",
)
async def create_order(
    payload: CreateOrderRequest,
    principal: Principal = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> CreateOrderResponse:
    items = await _build_items(
        db, payload.registration_ids, principal.user_id, partial=payload.mode == "cash_partial"
    )
    total_paise = sum(item["amount_paise"] for item in items)

    if 0 < total_paise < MIN_ORDER_PAISE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The amount to pay online is below the ₹1 minimum accepted by the payment gateway. "
                "Please choose packages with a higher total."
            ),
        )

    if total_paise == 0:
        free_order_id = f"{FREE_ORDER_PREFIX}{uuid.uuid4().hex}"
        db.add(PaymentOrder(razorpay_order_id=free_order_id, amount_paise=0, items=items))
        await db.commit()
        return CreateOrderResponse(
            order_id=free_order_id, amount=0, currency="INR", key_id="", is_free=True
        )

    order = await _create_razorpay_order(
        total_paise,
        receipt=f"kcy_{uuid.uuid4().hex[:24]}",
        notes={
            "registration_ids": ",".join(str(i["registration_id"]) for i in items)[:250],
            "mode": payload.mode,
        },
    )

    db.add(PaymentOrder(razorpay_order_id=order["id"], amount_paise=total_paise, items=items))
    await db.commit()

    logger.info("[Payment] Order created: %s amount=%d paise", order["id"], total_paise)

    return CreateOrderResponse(
        order_id=order["id"],
        amount=total_paise,
        currency="INR",
        key_id=settings.RAZORPAY_API_KEY,
    )


# ── POST /payments/verify ─────────────────────────────────────────────────────

@router.post(
    "/verify",
    response_model=VerifyPaymentResponse,
    summary="Verify Razorpay payment signature and mark the order's registrations as paid",
)
async def verify_payment(
    payload: VerifyPaymentRequest,
    _principal: Principal = Depends(require_user),  # the Razorpay signature proves the payment itself
    db: AsyncSession = Depends(get_db),
) -> VerifyPaymentResponse:
    if not settings.RAZORPAY_API_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Payment gateway not configured.")

    order = await _get_order_locked(db, payload.razorpay_order_id)
    if not order or order.amount_paise == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found.")

    if not _verify_checkout_signature(
        payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature
    ):
        logger.warning("[Payment] Signature mismatch order=%s payment=%s", payload.razorpay_order_id, payload.razorpay_payment_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment verification failed. Invalid signature.",
        )

    paid_ids, partial_ids = await _mark_order_paid(db, order, payload.razorpay_payment_id)
    return VerifyPaymentResponse(
        success=True,
        message=f"{len(paid_ids) + len(partial_ids)} registration(s) confirmed.",
        paid_registration_ids=paid_ids,
        partial_registration_ids=partial_ids,
    )


# ── POST /payments/confirm-free ───────────────────────────────────────────────

@router.post(
    "/confirm-free",
    response_model=VerifyPaymentResponse,
    summary="Confirm a ₹0 order (no gateway involved)",
)
async def confirm_free_order(
    payload: ConfirmFreeRequest,
    principal: Principal = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> VerifyPaymentResponse:
    order = await _get_order_locked(db, payload.order_id)
    if not order or order.amount_paise != 0 or not order.razorpay_order_id.startswith(FREE_ORDER_PREFIX):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Free order not found.")

    owners = (
        await db.scalars(select(Registration.user_id).where(Registration.id.in_(_order_registration_ids(order))))
    ).all()
    if any(owner != principal.user_id for owner in owners):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Free order not found.")

    paid_ids, partial_ids = await _mark_order_paid(db, order, FREE_PAYMENT_ID)
    return VerifyPaymentResponse(
        success=True,
        message=f"{len(paid_ids) + len(partial_ids)} registration(s) confirmed.",
        paid_registration_ids=paid_ids,
        partial_registration_ids=partial_ids,
    )


# ── POST /payments/webhook ────────────────────────────────────────────────────

@router.post(
    "/webhook",
    summary="Razorpay webhook — reconciles payments even if the browser never called /verify",
)
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Configure in Razorpay Dashboard → Webhooks with events `payment.captured`, `order.paid`
    (and optionally `payment.failed`), pointing at https://<api-host>/payments/webhook,
    using the secret stored in RAZORPAY_WEBHOOK_SECRET.
    """
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook not configured.")

    raw_body = await request.body()  # must be the untouched raw bytes for HMAC
    received = request.headers.get("X-Razorpay-Signature", "")
    expected = _hmac_sha256_hex(settings.RAZORPAY_WEBHOOK_SECRET, raw_body)
    if not hmac.compare_digest(expected, received):
        logger.warning("[Webhook] Invalid signature rejected")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature.")

    try:
        event = json.loads(raw_body)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed payload.")

    event_name = event.get("event")
    payment = ((event.get("payload") or {}).get("payment") or {}).get("entity") or {}

    if event_name in {"payment.captured", "order.paid"}:
        order_id = payment.get("order_id")
        payment_id = payment.get("id")
        if not order_id or not payment_id:
            return {"status": "ignored"}

        order = await _get_order_locked(db, order_id)
        if not order:
            logger.info("[Webhook] Unknown order %s — ignored", order_id)
            return {"status": "ignored"}
        if order.amount_paise != payment.get("amount"):
            logger.error(
                "[Webhook] Amount mismatch order=%s expected=%s got=%s — NOT marking paid",
                order_id, order.amount_paise, payment.get("amount"),
            )
            return {"status": "ignored"}

        await _mark_order_paid(db, order, payment_id)
    elif event_name == "payment.failed":
        logger.warning("[Webhook] Payment failed order=%s payment=%s", payment.get("order_id"), payment.get("id"))

    # Always 2xx for handled/ignored events so Razorpay doesn't retry them forever.
    return {"status": "ok"}
