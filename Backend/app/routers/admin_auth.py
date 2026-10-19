import asyncio
import hmac

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/admin", tags=["Admin"])


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginResponse(BaseModel):
    email: str
    name: str
    role: str


def _same(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


@router.post("/login", response_model=AdminLoginResponse, summary="Admin login (credentials from .env)")
async def admin_login(payload: AdminLoginRequest) -> AdminLoginResponse:
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin login is not configured.",
        )

    email_ok = _same(payload.email.strip().lower(), settings.ADMIN_EMAIL.strip().lower())
    password_ok = _same(payload.password, settings.ADMIN_PASSWORD)
    if not (email_ok and password_ok):
        await asyncio.sleep(0.5)  # slows down password guessing
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials.")

    return AdminLoginResponse(email=settings.ADMIN_EMAIL.strip().lower(), name="Yatra Admin", role="Super Admin")
