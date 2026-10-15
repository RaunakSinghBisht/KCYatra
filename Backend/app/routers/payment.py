"""
routers/payment.py — Razorpay order creation and payment verification.

Flow:
  1. Frontend calls POST /payments/create-order with list of registration IDs
     → Backend re-derives the age-discounted amount for each registration
       (passenger year_of_birth + yatra start_date → age → fare rule)
     → Creates a single Razorpay order for the computed total
     → Returns { order_id, amount, currency, key_id }

  2. Frontend opens Razorpay checkout with those details.

  3. On payment success, Razorpay returns { razorpay_order_id, razorpay_payment_id, razorpay_signature }
     Frontend calls POST /payments/verify with those + registration IDs

  4. Backend verifies the HMAC signature, re-derives discounted amounts, then marks each
     registration as paid.

Age-based fare rules (age = yatra start_date year − passenger year_of_birth):
  0–5 inclusive  → ₹0 (Free)
  6–10 inclusive → half of (hotel + travel package price)
  11+            → full price
"""

import hashlib
import hmac
import logging
import re

import razorpay

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud.registration import update_registration_payment
from app.dependencies.db import get_db
from app.models.passenger import Passenger
from app.models.registration import Registration
from app.models.yatra import Yatra

logger = logging.getLogger("kcyatra")

router = APIRouter(prefix="/payments", tags=["Payments"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    registration_ids: list[int]


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int          # paise (INR × 100)
    currency: str
    key_id: str          # Razorpay public key — safe to expose to frontend


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    registration_ids: list[int]


class VerifyPaymentResponse(BaseModel):
    success: bool
    message: str
    paid_registration_ids: list[int]


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


def _verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay HMAC-SHA256 signature to confirm payment authenticity."""
    body = f"{order_id}|{payment_id}"
    expected = hmac.new(
        settings.RAZORPAY_API_SECRET.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _parse_pkg_price(pkg_str: str | None) -> float:
    """
    Extract the price from a stored package string of the form "Title : Price".
    Returns 0.0 if the string is None, empty, or does not match the pattern.
    """
    if not pkg_str:
        return 0.0
    # Find the last " : " and take everything after it as the price
    idx = pkg_str.rfind(" : ")
    if idx == -1:
        return 0.0
    try:
        return float(pkg_str[idx + 3:].strip())
    except ValueError:
        return 0.0


def _age_at_start(year_of_birth: int, yatra_start_year: int) -> int:
    """Simple age = yatra start year − passenger year_of_birth."""
    return yatra_start_year - year_of_birth


def _discounted_amount(base_amount: float, age: int) -> float:
    """Apply the age-based fare rule and return the adjusted amount."""
    if age <= 5:
        return 0.0
    if age <= 10:
        return round(base_amount / 2, 2)
    return base_amount


async def _compute_amounts(
    db: AsyncSession,
    registration_ids: list[int],
) -> dict[int, float]:
    """
    For each registration ID, fetch the registration + its passenger + its yatra,
    derive the passenger's age at the yatra start date, apply the fare rule, and
    return a mapping { registration_id: discounted_amount_inr }.
    Raises HTTPException 404 if any registration is missing.
    """
    amounts: dict[int, float] = {}
    for reg_id in registration_ids:
        reg: Registration | None = await db.scalar(
            select(Registration).where(Registration.id == reg_id)
        )
        if not reg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Registration {reg_id} not found.",
            )

        passenger: Passenger | None = await db.scalar(
            select(Passenger).where(Passenger.id == reg.passenger_id)
        )
        yatra: Yatra | None = await db.scalar(
            select(Yatra).where(Yatra.id == reg.yatra_id)
        )
        if not passenger or not yatra:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Passenger or Yatra not found for registration {reg_id}.",
            )

        hotel_price = _parse_pkg_price(reg.hotel_package)
        travel_price = _parse_pkg_price(reg.travel_package)
        base = hotel_price + travel_price

        yatra_start_year: int = yatra.start_date.year
        age = _age_at_start(passenger.year_of_birth, yatra_start_year)
        amounts[reg_id] = _discounted_amount(base, age)

    return amounts


# ── POST /payments/create-order ───────────────────────────────────────────────

@router.post(
    "/create-order",
    response_model=CreateOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Razorpay order for the selected registrations",
)
async def create_order(
    payload: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
) -> CreateOrderResponse:
    """
    Re-derives the age-discounted amount for each registration on the backend
    (not trusting frontend values), then creates a single Razorpay order.
    """
    if not payload.registration_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No registrations selected.",
        )

    amounts = await _compute_amounts(db, payload.registration_ids)
    total_inr = sum(amounts.values())

    if total_inr < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total amount cannot be negative.",
        )

    if total_inr == 0:
        return CreateOrderResponse(
            order_id="FREE_ORDER",
            amount=0,
            currency="INR",
            key_id="FREE",
        )

    total_paise = int(total_inr * 100)  # Razorpay works in smallest currency unit

    try:
        client = _razorpay_client()
        order = client.order.create({
            "amount": total_paise,
            "currency": "INR",
            "payment_capture": 1,  # auto-capture on success
        })
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[Payment] Razorpay order creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create payment order. Please try again.",
        ) from exc

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
    summary="Verify Razorpay payment signature and mark registrations as paid",
)
async def verify_payment(
    payload: VerifyPaymentRequest,
    db: AsyncSession = Depends(get_db),
) -> VerifyPaymentResponse:
    """
    1. Verifies the Razorpay HMAC-SHA256 signature (prevents tampered callbacks).
    2. Re-derives the age-discounted amount for each registration (same rule as create-order).
    3. Marks each registration in registration_ids as payment_status='paid',
       stores the transaction_id and independently computed amount_paid.
    """
    # ── Re-derive amounts (same logic as create-order, ignores frontend values) ──
    amounts = await _compute_amounts(db, payload.registration_ids)
    total_inr = sum(amounts.values())

    # ── Signature verification ────────────────────────────────────────────────
    if payload.razorpay_order_id == "FREE_ORDER":
        if total_inr > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment required for these registrations.",
            )
        # Bypassing signature verification for free order
    elif not _verify_signature(
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
        payload.razorpay_signature,
    ):
        logger.warning(
            "[Payment] Signature mismatch for order=%s payment=%s",
            payload.razorpay_order_id,
            payload.razorpay_payment_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment verification failed. Invalid signature.",
        )

    # ── Mark registrations as paid ────────────────────────────────────────────
    paid_ids: list[int] = []
    for reg_id in payload.registration_ids:
        amount = amounts.get(reg_id, 0.0)
        reg = await update_registration_payment(
            db,
            registration_id=reg_id,
            transaction_id=payload.razorpay_payment_id,
            amount_paid=amount,
        )
        if reg:
            paid_ids.append(reg_id)
            logger.info(
                "[Payment] Registration %d marked paid txn=%s amount=%.2f",
                reg_id, payload.razorpay_payment_id, amount,
            )
        else:
            logger.warning("[Payment] Registration %d not found after payment.", reg_id)

    return VerifyPaymentResponse(
        success=True,
        message=f"{len(paid_ids)} registration(s) confirmed as paid.",
        paid_registration_ids=paid_ids,
    )
