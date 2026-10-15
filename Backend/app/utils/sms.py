"""
utils/sms.py — Reliable SMS delivery via Fast2SMS DLT route.

Design principles:
  1. RETRY  — Up to 3 attempts with exponential back-off before giving up.
  2. ASYNC  — All I/O is non-blocking (httpx.AsyncClient).
               Fire-and-forget tasks use asyncio.create_task so the calling
               request returns instantly without waiting for delivery.
  3. LOGGED — Every send attempt (success or failure) is logged with reason.
  4. SAFE   — Never raises; always returns a result. Failures are logged only.

Public API:
  send_otp_sms(phone_digits, otp)              — awaitable, returns bool
  send_otp_sms_async(phone_digits, otp)        — fire-and-forget (no await needed)
  send_payment_success_sms(phone, yatra_title,
                            start_date, end_date) — fire-and-forget
"""

import asyncio
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("kcyatra")

_FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"
_MAX_RETRIES  = 3           # max delivery attempts per SMS
_RETRY_DELAYS = [2, 5, 10]  # seconds between retries (exponential-ish)
_TIMEOUT      = 12.0        # seconds per HTTP request


# ── Internal: core delivery with retry ───────────────────────────────────────

async def _send_dlt_sms(
    api_key:      str,
    sender_id:    str,
    template_id:  str,
    var_values:   str,
    phone_digits: str,
    label:        str = "SMS",
) -> bool:
    """
    Attempt to deliver a DLT-route SMS — up to _MAX_RETRIES tries.

    Args:
        api_key:      Fast2SMS authorization key.
        sender_id:    Registered DLT sender ID (e.g. GMDTRX).
        template_id:  DLT template ID registered on Fast2SMS.
        var_values:   Pipe-separated variable values (e.g. '123456|').
        phone_digits: 10-digit phone number (no +91).
        label:        Log label shown in every log line ('OTP', 'Payment', …).

    Returns:
        True if delivery confirmed by Fast2SMS, False after all retries exhausted.
    """
    params = {
        "authorization":    api_key,
        "route":            "dlt",
        "sender_id":        sender_id,
        "message":          template_id,
        "variables_values": var_values,
        "numbers":          phone_digits,
        "flash":            "0",
        "schedule_time":    "",
    }
    masked = f"XXXXXX{phone_digits[-4:]}"
    last_error: str | None = None

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                resp = await client.get(_FAST2SMS_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

                if data.get("return", False):
                    logger.info(
                        "[SMS:%s] SUCCESS attempt=%d phone=%s request_id=%s",
                        label, attempt, masked, data.get("request_id", "?"),
                    )
                    return True

                # API returned HTTP 200 but success=false — log reason
                raw_msg   = data.get("message", "Unknown error")
                err_msg   = " ".join(raw_msg) if isinstance(raw_msg, list) else str(raw_msg)
                last_error = f"API rejected: {err_msg}"
                logger.warning(
                    "[SMS:%s] API REJECTED attempt=%d phone=%s reason=%r",
                    label, attempt, masked, err_msg,
                )

            except httpx.TimeoutException:
                last_error = "Request timed out"
                logger.warning(
                    "[SMS:%s] TIMEOUT attempt=%d/%d phone=%s",
                    label, attempt, _MAX_RETRIES, masked,
                )
            except httpx.NetworkError:
                last_error = "Network connection error"
                logger.warning(
                    "[SMS:%s] CONNECTION ERROR attempt=%d/%d phone=%s",
                    label, attempt, _MAX_RETRIES, masked,
                )
            except Exception as exc:
                last_error = str(exc)
                logger.warning(
                    "[SMS:%s] UNEXPECTED ERROR attempt=%d/%d phone=%s error=%s",
                    label, attempt, _MAX_RETRIES, masked, exc,
                )

            # Wait before next retry (skip wait on last attempt)
            if attempt < _MAX_RETRIES:
                delay = _RETRY_DELAYS[attempt - 1]
                logger.info("[SMS:%s] Retrying in %ds…", label, delay)
                await asyncio.sleep(delay)

    logger.error(
        "[SMS:%s] FAILED after %d attempts phone=%s last_error=%r",
        label, _MAX_RETRIES, masked, last_error,
    )
    return False


# ── OTP SMS ──────────────────────────────────────────────────────────────────

async def send_otp_sms(phone_digits: str, otp: str) -> bool:
    """
    Send an OTP SMS (awaitable / blocking in the async sense).

    Use this when you need the delivery result before responding to the caller.
    Retries up to 3 times on failure.

    Args:
        phone_digits: 10-digit phone (no country code / +91).
        otp:          6-digit OTP string.

    Returns:
        True if SMS confirmed delivered, False if all retries failed.
    """
    if not settings.FAST2SMS_API_KEY:
        logger.warning("[SMS:OTP] FAST2SMS_API_KEY not configured — OTP not sent.")
        return False

    return await _send_dlt_sms(
        api_key=settings.FAST2SMS_API_KEY,
        sender_id=settings.FAST2SMS_SENDER_ID,
        template_id=settings.FAST2SMS_OTP_TEMPLATE_ID,
        var_values=f"{otp}|",
        phone_digits=phone_digits,
        label="OTP",
    )


def send_otp_sms_async(phone_digits: str, otp: str) -> None:
    """
    Dispatch OTP SMS as a fire-and-forget asyncio task (non-blocking).

    Call this inside an async route handler. The task runs in the background
    so the HTTP response is returned immediately without waiting for delivery.

    Args:
        phone_digits: 10-digit phone (no country code / +91).
        otp:          OTP string already stored server-side.
    """
    async def _task() -> None:
        success = await send_otp_sms(phone_digits, otp)
        if not success:
            logger.error(
                "[SMS:OTP-ASYNC] Final delivery failure phone=XXXXXX%s"
                " — OTP stored but not delivered.",
                phone_digits[-4:],
            )

    asyncio.create_task(_task())
    logger.info("[SMS:OTP-ASYNC] Task created for XXXXXX%s", phone_digits[-4:])


# ── Payment confirmation SMS ──────────────────────────────────────────────────

def send_payment_success_sms(
    phone: str,
    yatra_title: str,
    start_date: str = "",
    end_date: str = "",
) -> None:
    """
    Send a payment-success SMS (fire-and-forget).

    Non-blocking — payment is already confirmed before this runs.
    Retries up to 3 times in the background asyncio task.

    Args:
        phone:       Phone in +91XXXXXXXXXX or plain 10-digit format.
        yatra_title: Name of the yatra (truncated to 30 chars for DLT var).
        start_date:  Human-readable start date string, e.g. '12Oct'.
        end_date:    Human-readable end date string, e.g. '18Oct'.
    """
    if not phone or not settings.FAST2SMS_API_KEY:
        if not settings.FAST2SMS_API_KEY:
            logger.warning("[SMS:Payment] FAST2SMS_API_KEY not configured — payment SMS not sent.")
        return

    phone_digits = phone.replace("+91", "").strip()

    if start_date and end_date:
        yatra_info = f"{yatra_title}({start_date}-{end_date})"
    else:
        yatra_info = yatra_title
    yatra_info = yatra_info[:30]  # DLT variable hard cap

    async def _task() -> None:
        await _send_dlt_sms(
            api_key=settings.FAST2SMS_API_KEY,
            sender_id=settings.FAST2SMS_SENDER_ID,
            template_id=settings.FAST2SMS_PAYMENT_TEMPLATE_ID,
            var_values=yatra_info,
            phone_digits=phone_digits,
            label="Payment",
        )

    asyncio.create_task(_task())
