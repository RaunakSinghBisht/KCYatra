"""JWT creation and validation. Access and refresh tokens are told apart by the "typ" claim."""

import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings

ACCESS = "access"
REFRESH = "refresh"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_token(
    *,
    token_type: str,
    subject: str,
    role: str,
    session_id: str,
    expires_at: datetime,
    jti: str | None = None,
) -> str:
    claims: dict[str, object] = {
        "sub": subject,
        "role": role,
        "sid": session_id,
        "typ": token_type,
        "iat": int(utcnow().timestamp()),
        "exp": int(expires_at.timestamp()),
        # Refresh tokens carry the session's rotating id; access tokens get a random one.
        "jti": jti or secrets.token_urlsafe(16),
    }
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict | None:
    """Return the claims of a valid, unexpired token of the expected type, else None."""
    try:
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    if claims.get("typ") != expected_type or not claims.get("sid") or not claims.get("sub"):
        return None
    return claims


def access_token_ttl() -> timedelta:
    return timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)


def refresh_token_ttl(role: str) -> timedelta:
    days = settings.REFRESH_TOKEN_EXPIRE_DAYS_ADMIN if role == "admin" else settings.REFRESH_TOKEN_EXPIRE_DAYS_USER
    return timedelta(days=days)
