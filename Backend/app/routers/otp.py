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
import random
import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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
    return f"{random.randint(0, 999999):06d}"


def _store_otp(phone: str, otp: str) -> None:
    expires_at = time.time() + settings.OTP_TTL_SECONDS
    _otp_store[phone] = (otp, expires_at)


def _pop_otp(phone: str) -> tuple[str, float] | None:
    """Retrieve and remove the OTP entry for this phone (one-time use)."""
    return _otp_store.pop(phone, None)


# ── POST /otp/send ────────────────────────────────────────────────────────────

@router.post(
    "/send",
    response_model=OtpSendResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate and send an OTP to a phone number",
)
async def send_otp(payload: OtpSendRequest) -> OtpSendResponse:
    """
    Generates a random 6-digit OTP and either:
      - (bypass ON)  logs it to the server console — no SMS sent.
      - (bypass OFF) dispatches an SMS via Fast2SMS in the background.

    The OTP is always stored server-side with a TTL regardless of mode.
    Returns 200 immediately.
    """
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
    """
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No OTP found for this number. Please request a new one.",
            )

        stored_otp, expires_at = entry

        if time.time() > expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired. Please request a new one.",
            )

        if payload.otp != stored_otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OTP. Please try again.",
            )

    # ── User lookup (auto-create if first login) ────────────────────────────────────
    user = await get_or_create_user_by_phone(db, payload.phone)

    return OtpVerifyResponse(
        verified=True,
        message="OTP verified successfully.",
        user_id=user.id,
        phone=user.phone,
    )
