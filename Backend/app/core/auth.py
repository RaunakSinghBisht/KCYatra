"""
Session lifecycle for users and admins.

- Login starts an AuthSession (one per device) and issues an access token (in the response body)
  plus a refresh token (in an HttpOnly cookie scoped to the realm's auth path).
- Refresh rotates the refresh token. Presenting an already-rotated token outside the short grace
  window is treated as token theft and revokes the whole session.
- Every access token carries its session id, and requests check that session is still active,
  so logging out (one device or all) takes effect immediately.
"""

import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import Request, Response
from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    ACCESS,
    REFRESH,
    access_token_ttl,
    create_token,
    decode_token,
    refresh_token_ttl,
    utcnow,
)
from app.models.auth_session import AuthSession

logger = logging.getLogger("kcyatra")


@dataclass(frozen=True)
class Realm:
    role: str  # "user" | "admin"
    cookie_name: str
    cookie_path: str  # the refresh cookie is only ever sent to this path


USER_REALM = Realm(role="user", cookie_name="kcy_rt", cookie_path="/auth")
ADMIN_REALM = Realm(role="admin", cookie_name="kcy_admin_rt", cookie_path="/admin/auth")


class AuthError(Exception):
    pass


@dataclass
class IssuedTokens:
    access_token: str
    expires_in: int  # seconds until the access token expires
    refresh_token: str
    refresh_expires_at: datetime
    session_id: str
    subject_id: str


# ── Cookie helpers ────────────────────────────────────────────────────────────

def _cookie_secure() -> bool:
    if settings.AUTH_COOKIE_SECURE is not None:
        return settings.AUTH_COOKIE_SECURE
    return settings.ENV == "production"


def set_refresh_cookie(response: Response, realm: Realm, tokens: IssuedTokens) -> None:
    response.set_cookie(
        key=realm.cookie_name,
        value=tokens.refresh_token,
        max_age=max(0, int((tokens.refresh_expires_at - utcnow()).total_seconds())),
        path=realm.cookie_path,
        httponly=True,
        secure=_cookie_secure(),
        samesite="strict",
    )


def clear_refresh_cookie(response: Response, realm: Realm) -> None:
    response.delete_cookie(
        key=realm.cookie_name,
        path=realm.cookie_path,
        httponly=True,
        secure=_cookie_secure(),
        samesite="strict",
    )


def client_metadata(request: Request) -> tuple[str | None, str | None]:
    user_agent = (request.headers.get("user-agent") or "")[:300] or None
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    ip = request.headers.get("x-real-ip") or forwarded or (request.client.host if request.client else None)
    return user_agent, (ip[:64] if ip else None)


# ── Token issuing ─────────────────────────────────────────────────────────────

def _issue(session: AuthSession, realm: Realm) -> IssuedTokens:
    now = utcnow()
    access_expires = now + access_token_ttl()
    access = create_token(
        token_type=ACCESS,
        subject=session.subject_id,
        role=realm.role,
        session_id=session.id,
        expires_at=access_expires,
    )
    refresh = create_token(
        token_type=REFRESH,
        subject=session.subject_id,
        role=realm.role,
        session_id=session.id,
        expires_at=session.expires_at,
        jti=session.refresh_jti,
    )
    return IssuedTokens(
        access_token=access,
        expires_in=int((access_expires - now).total_seconds()),
        refresh_token=refresh,
        refresh_expires_at=session.expires_at,
        session_id=session.id,
        subject_id=session.subject_id,
    )


async def start_session(db: AsyncSession, realm: Realm, subject_id: str, request: Request) -> IssuedTokens:
    now = utcnow()
    user_agent, ip = client_metadata(request)

    # Housekeeping: drop this subject's sessions that ended more than a week ago.
    stale_before = now - timedelta(days=7)
    await db.execute(
        delete(AuthSession).where(
            AuthSession.subject_type == realm.role,
            AuthSession.subject_id == subject_id,
            or_(AuthSession.expires_at < stale_before, AuthSession.revoked_at < stale_before),
        )
    )

    session = AuthSession(
        id=str(uuid.uuid4()),
        subject_type=realm.role,
        subject_id=subject_id,
        refresh_jti=secrets.token_urlsafe(32),
        user_agent=user_agent,
        ip_address=ip,
        last_used_at=now,
        expires_at=now + refresh_token_ttl(realm.role),
    )
    db.add(session)
    await db.commit()
    return _issue(session, realm)


async def rotate_session(db: AsyncSession, realm: Realm, refresh_token: str | None, request: Request) -> IssuedTokens:
    claims = decode_token(refresh_token, REFRESH) if refresh_token else None
    if not claims or claims.get("role") != realm.role:
        raise AuthError("Invalid refresh token.")

    session = await db.scalar(
        select(AuthSession).where(AuthSession.id == claims["sid"]).with_for_update()
    )
    now = utcnow()
    if (
        session is None
        or session.subject_type != realm.role
        or session.subject_id != claims["sub"]
        or session.revoked_at is not None
        or session.expires_at <= now
    ):
        raise AuthError("Session is no longer active.")

    jti = claims.get("jti")
    in_grace = (
        jti is not None
        and jti == session.previous_jti
        and session.rotated_at is not None
        and now - session.rotated_at <= timedelta(seconds=settings.REFRESH_REUSE_GRACE_SECONDS)
    )
    if jti != session.refresh_jti and not in_grace:
        # An old refresh token came back after it was rotated — assume it was stolen.
        session.revoked_at = now
        await db.commit()
        logger.warning("[Auth] Refresh token reuse detected — session %s (%s) revoked", session.id, realm.role)
        raise AuthError("Session is no longer active.")

    user_agent, ip = client_metadata(request)
    session.previous_jti = session.refresh_jti
    session.refresh_jti = secrets.token_urlsafe(32)
    session.rotated_at = now
    session.last_used_at = now
    session.expires_at = now + refresh_token_ttl(realm.role)
    session.user_agent = user_agent or session.user_agent
    session.ip_address = ip or session.ip_address
    tokens = _issue(session, realm)
    await db.commit()
    return tokens


# ── Lookup / revoke ───────────────────────────────────────────────────────────

def session_id_from_refresh(refresh_token: str | None, realm: Realm) -> str | None:
    claims = decode_token(refresh_token, REFRESH) if refresh_token else None
    if not claims or claims.get("role") != realm.role:
        return None
    return claims["sid"]


def session_id_from_access(access_token: str | None, realm: Realm) -> str | None:
    claims = decode_token(access_token, ACCESS) if access_token else None
    if not claims or claims.get("role") != realm.role:
        return None
    return claims["sid"]


async def get_active_session(db: AsyncSession, session_id: str) -> AuthSession | None:
    session = await db.get(AuthSession, session_id)
    if session is None or session.revoked_at is not None or session.expires_at <= utcnow():
        return None
    return session


async def revoke_session(db: AsyncSession, session_id: str, realm: Realm, subject_id: str | None = None) -> bool:
    conditions = [
        AuthSession.id == session_id,
        AuthSession.subject_type == realm.role,
        AuthSession.revoked_at.is_(None),
    ]
    if subject_id is not None:
        conditions.append(AuthSession.subject_id == subject_id)
    result = await db.execute(update(AuthSession).where(*conditions).values(revoked_at=utcnow()))
    await db.commit()
    return (result.rowcount or 0) > 0


async def revoke_all_sessions(db: AsyncSession, realm: Realm, subject_id: str) -> int:
    result = await db.execute(
        update(AuthSession)
        .where(
            AuthSession.subject_type == realm.role,
            AuthSession.subject_id == subject_id,
            AuthSession.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow())
    )
    await db.commit()
    return result.rowcount or 0


async def list_active_sessions(db: AsyncSession, realm: Realm, subject_id: str) -> list[AuthSession]:
    rows = await db.scalars(
        select(AuthSession)
        .where(
            AuthSession.subject_type == realm.role,
            AuthSession.subject_id == subject_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > utcnow(),
        )
        .order_by(AuthSession.last_used_at.desc())
    )
    return list(rows.all())
