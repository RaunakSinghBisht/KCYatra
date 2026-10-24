"""
routers/otp.py — OTP send & verify endpoints.

OTP storage:
    In-memory dict keyed by phone → (otp, expires_at).
    Simple and fast for a single-server deployment.
    Replace with Redis if you scale to multiple workers.

Bypass mode (OTP_BYPASS_ENABLED=true in .env):
    - POST /otp/send  — skips SMS, logs the generated OTP to console instead.
    - POST /otp/verify — accepts hardcoded "123456" without store lookup.
    Set OTP_BYPASS_ENABLED=false in production.

Endpoints:
    POST /otp/send    — generate OTP, dispatch SMS (or log), store with TTL
    POST /otp/verify  — validate OTP, return user info for session
"""

import logging
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import USER_REALM, set_refresh_cookie, start_session
from app.core.config import settings
from app.core.rate_limit import LIMITS, client_ip, human_wait, limiter, too_many_requests
from app.crud.dam_page import get_dam_page
from app.crud.user import get_or_create_user_by_phone
from app.dependencies.db import get_db
from app.schemas.otp import (
    OtpSendRequest,
    OtpSendResponse,
    OtpVerifyRequest,
    OtpVerifyResponse,
)
from app.utils.sms import send_otp_sms_async

logger = logging.getLogger("kcyatra")

router = APIRouter(prefix="/otp", tags=["OTP"])

_BYPASS_OTP = "123456"

# ── In-memory OTP store: phone → (otp_code, expires_at_unix) ─────────────────
# Not shared across workers — use Redis for multi-process deployments.
_otp_store: dict[str, tuple[str, float]] = {}


def _generate_otp() -> str:
    """Return a zero-padded random 6-digit OTP string."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _store_otp(phone: str, otp: str) -> None:
    expires_at = time.time() + settings.OTP_TTL_SECONDS
    _otp_store[phone] = (otp, expires_at)


def _pop_otp(phone: str) -> tuple[str, float] | None:
    """Retrieve and remove the OTP entry for this phone (one-time use)."""
    return _otp_store.pop(phone, None)


# ── Rate limiting ─────────────────────────────────────────────────────────────

_HOUR = 3600


def _enforce_send_limits(phone: str | None, ip: str) -> None:
    """Raise 429 if this phone / IP is requesting OTPs (or direct logins) too often, else record the request."""
    if phone is not None:
        wait = limiter.wait_seconds(f"otp:send:cooldown:{phone}", 1, LIMITS.otp_resend_cooldown_seconds)
        if wait:
            raise too_many_requests(wait, f"Please wait {human_wait(wait)} before requesting another OTP.")
        wait = limiter.wait_seconds(f"otp:send:phone:{phone}", LIMITS.otp_send_max_per_phone_per_hour, _HOUR)
        if wait:
            raise too_many_requests(
                wait, f"Too many OTP requests for this number. Please try again in {human_wait(wait)}."
            )
    wait = limiter.wait_seconds(f"otp:send:ip:{ip}", LIMITS.otp_send_max_per_ip_per_hour, _HOUR)
    if wait:
        raise too_many_requests(wait, f"Too many requests from your network. Please try again in {human_wait(wait)}.")

    if phone is not None:
        limiter.hit(f"otp:send:cooldown:{phone}")
        limiter.hit(f"otp:send:phone:{phone}")
    limiter.hit(f"otp:send:ip:{ip}")


def _ensure_verify_allowed(phone: str, ip: str) -> None:
    for key, limit in (
        (f"otp:verify:phone:{phone}", LIMITS.otp_verify_max_failures_per_phone),
        (f"otp:verify:ip:{ip}", LIMITS.otp_verify_max_failures_per_ip),
    ):
        wait = limiter.wait_seconds(key, limit, LIMITS.otp_verify_window_seconds)
        if wait:
            raise too_many_requests(wait, f"Too many incorrect attempts. Please try again in {human_wait(wait)}.")


def _reject_verify(phone: str, ip: str, detail: str) -> None:
    limiter.hit(f"otp:verify:phone:{phone}")
    limiter.hit(f"otp:verify:ip:{ip}")
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


# ── POST /otp/send ────────────────────────────────────────────────────────────

@router.post(
    "/send",
    response_model=OtpSendResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate and send an OTP to a phone number",
)
async def send_otp(payload: OtpSendRequest, request: Request) -> OtpSendResponse:
    """
    Generates a random 6-digit OTP and either:
      - (bypass ON)  logs it to the server console — no SMS sent.
      - (bypass OFF) dispatches an SMS via Fast2SMS in the background.

    The OTP is always stored server-side with a TTL regardless of mode.
    Rate limited per phone number and per IP (429 when exceeded).
    Returns 200 immediately.
    """
    _enforce_send_limits(payload.phone, client_ip(request))

    otp = _generate_otp()
    _store_otp(payload.phone, otp)

    if settings.OTP_BYPASS_ENABLED:
        # Development mode — print OTP to server logs, skip SMS
        logger.warning(
            "[OTP:BYPASS] phone=XXXXXX%s otp=%s  ← bypass mode, no SMS sent",
            payload.phone[-4:],
            otp,
        )
    else:
        # Production mode — fire-and-forget SMS
        send_otp_sms_async(payload.phone, otp)

    return OtpSendResponse(
        message="OTP sent successfully.",
        bypass_active=settings.OTP_BYPASS_ENABLED,
    )


# ── POST /otp/verify ──────────────────────────────────────────────────────────

@router.post(
    "/verify",
    response_model=OtpVerifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify OTP and return user session info",
)
async def verify_otp(
    payload: OtpVerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> OtpVerifyResponse:
    """
    Validates the OTP for a given phone number, then looks up the user.

    Bypass mode (OTP_BYPASS_ENABLED=true):
        Accepts "123456" as a valid OTP for any phone, skipping store lookup.
        Still performs the real user lookup — phone must exist in the DB.

    Normal mode:
        - OTP is consumed on first use (one-time).
        - Expired OTPs return 400.
        - Wrong OTP returns 400 (same message to prevent enumeration).

    On success, returns user_id, full_name, and phone so the frontend
    can hydrate the session without a separate /users/ call.

    Wrong / expired codes are counted per phone and per IP; too many returns 429.
    """
    ip = client_ip(request)
    _ensure_verify_allowed(payload.phone, ip)

    # ── OTP validation ────────────────────────────────────────────────────────
    if settings.OTP_BYPASS_ENABLED and payload.otp == _BYPASS_OTP:
        logger.warning(
            "[OTP:BYPASS] Hardcoded OTP accepted for XXXXXX%s",
            payload.phone[-4:],
        )
        # Remove any pending real OTP so it isn't usable after bypass
        _otp_store.pop(payload.phone, None)
    else:
        entry = _pop_otp(payload.phone)

        if entry is None:
            _reject_verify(payload.phone, ip, "No OTP found for this number. Please request a new one.")

        stored_otp, expires_at = entry  # type: ignore[misc]

        if time.time() > expires_at:
            _reject_verify(payload.phone, ip, "OTP has expired. Please request a new one.")

        if payload.otp != stored_otp:
            _reject_verify(payload.phone, ip, "Invalid OTP. Please try again.")

    # A correct code clears this phone's failed-attempt count (the IP's count keeps running).
    limiter.clear(f"otp:verify:phone:{payload.phone}")

    # ── User lookup (auto-create if first login) ────────────────────────────────────
    user = await get_or_create_user_by_phone(db, payload.phone)

    tokens = await start_session(db, USER_REALM, str(user.id), request)
    set_refresh_cookie(response, USER_REALM, tokens)
    return OtpVerifyResponse(
        verified=True,
        message="OTP verified successfully.",
        user_id=user.id,
        phone=user.phone,
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
    )


# ── POST /otp/direct-login ────────────────────────────────────────────────────

@router.post(
    "/direct-login",
    response_model=OtpVerifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Login with phone only (no OTP) — only when otp_enabled=false in site settings",
)
async def direct_login(
    payload: OtpSendRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> OtpVerifyResponse:
    """
    Allows phone-only login when the admin has disabled OTP verification.
    Returns 403 if OTP is still enabled in site settings.
    """
    site = await get_dam_page(db)
    if site.otp_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OTP login is required. Direct login is not permitted.",
        )
    # No SMS is sent here, so only the per-IP cap applies.
    _enforce_send_limits(None, client_ip(request))

    user = await get_or_create_user_by_phone(db, payload.phone)
    tokens = await start_session(db, USER_REALM, str(user.id), request)
    set_refresh_cookie(response, USER_REALM, tokens)
    return OtpVerifyResponse(
        verified=True,
        message="Logged in without OTP.",
        user_id=user.id,
        phone=user.phone,
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
    )
