import asyncio
import hmac

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ADMIN_REALM, set_refresh_cookie, start_session
from app.core.config import settings
from app.core.rate_limit import LIMITS, client_ip, human_wait, limiter, too_many_requests
from app.dependencies.auth import ADMIN_NAME, ADMIN_ROLE_LABEL
from app.dependencies.db import get_db
from app.schemas.auth import AdminProfile, AdminTokenResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


class AdminLoginRequest(BaseModel):
    email: str
    password: str


def _same(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


@router.post("/login", response_model=AdminTokenResponse, summary="Admin login (credentials from .env)")
async def admin_login(
    payload: AdminLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AdminTokenResponse:
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin login is not configured.",
        )

    ip_key = f"admin:login:ip:{client_ip(request)}"
    wait = limiter.wait_seconds(ip_key, LIMITS.admin_login_max_failures_per_ip, LIMITS.admin_login_window_seconds)
    if wait:
        raise too_many_requests(wait, f"Too many failed login attempts. Please try again in {human_wait(wait)}.")

    admin_email = settings.ADMIN_EMAIL.strip().lower()
    email_ok = _same(payload.email.strip().lower(), admin_email)
    password_ok = _same(payload.password, settings.ADMIN_PASSWORD)
    if not (email_ok and password_ok):
        limiter.hit(ip_key)
        await asyncio.sleep(0.5)  # slows down password guessing
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials.")
    limiter.clear(ip_key)

    tokens = await start_session(db, ADMIN_REALM, admin_email, request)
    set_refresh_cookie(response, ADMIN_REALM, tokens)
    return AdminTokenResponse(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
        admin=AdminProfile(email=admin_email, name=ADMIN_NAME, role=ADMIN_ROLE_LABEL),
    )
