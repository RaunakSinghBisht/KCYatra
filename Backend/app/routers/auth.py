"""
Session endpoints, identical for both realms:

    /auth/...        customers      (refresh cookie: kcy_rt,       path /auth)
    /admin/auth/...  admin panel    (refresh cookie: kcy_admin_rt, path /admin/auth)

    POST   /refresh          rotate the refresh token, return a new access token
    POST   /logout           end this device's session
    POST   /logout-all       end every session of this account
    GET    /sessions         list active sessions (devices)
    DELETE /sessions/{id}    end one specific session
    GET    /me               current profile

Logging in happens at POST /otp/verify, /otp/direct-login (customers) and POST /admin/login.
"""

from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    ADMIN_REALM,
    USER_REALM,
    AuthError,
    Realm,
    clear_refresh_cookie,
    list_active_sessions,
    revoke_all_sessions,
    revoke_session,
    rotate_session,
    session_id_from_access,
    session_id_from_refresh,
    set_refresh_cookie,
)
from app.core.config import settings
from app.dependencies.auth import (
    ADMIN_NAME,
    ADMIN_ROLE_LABEL,
    Principal,
    bearer_scheme,
    require_admin,
    require_user,
)
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.auth import (
    AdminProfile,
    AdminTokenResponse,
    SessionInfo,
    UserProfile,
    UserTokenResponse,
)

ProfileLoader = Callable[[AsyncSession, str], Awaitable[dict | None]]


async def load_user_profile(db: AsyncSession, subject_id: str) -> dict | None:
    try:
        user = await db.get(User, int(subject_id))
    except ValueError:
        return None
    if user is None:
        return None
    return {"user": UserProfile(user_id=user.id, phone=user.phone)}


async def load_admin_profile(db: AsyncSession, subject_id: str) -> dict | None:
    if not settings.ADMIN_EMAIL or subject_id != settings.ADMIN_EMAIL.strip().lower():
        return None
    return {"admin": AdminProfile(email=subject_id, name=ADMIN_NAME, role=ADMIN_ROLE_LABEL)}


def _session_ended(realm: Realm, detail: str = "Session expired. Please log in again.") -> JSONResponse:
    resp = JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": detail},
        headers={"WWW-Authenticate": "Bearer"},
    )
    clear_refresh_cookie(resp, realm)
    return resp


def _build_router(
    *,
    realm: Realm,
    prefix: str,
    tag: str,
    require: Callable[..., Awaitable[Principal]],
    load_profile: ProfileLoader,
    token_model: type,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    @router.post("/refresh", response_model=token_model, summary="Rotate refresh token, get a new access token")
    async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
        try:
            tokens = await rotate_session(db, realm, request.cookies.get(realm.cookie_name), request)
        except AuthError:
            return _session_ended(realm)

        profile = await load_profile(db, tokens.subject_id)
        if profile is None:  # account gone / admin email changed
            await revoke_session(db, tokens.session_id, realm)
            return _session_ended(realm)

        set_refresh_cookie(response, realm, tokens)
        return {"access_token": tokens.access_token, "expires_in": tokens.expires_in, **profile}

    @router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Log out this device")
    async def logout(
        request: Request,
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
        db: AsyncSession = Depends(get_db),
    ) -> Response:
        session_id = session_id_from_refresh(request.cookies.get(realm.cookie_name), realm) or (
            session_id_from_access(credentials.credentials, realm) if credentials else None
        )
        if session_id:
            await revoke_session(db, session_id, realm)
        resp = Response(status_code=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(resp, realm)
        return resp

    @router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT, summary="Log out from all devices")
    async def logout_all(
        principal: Principal = Depends(require),
        db: AsyncSession = Depends(get_db),
    ) -> Response:
        await revoke_all_sessions(db, realm, principal.subject_id)
        resp = Response(status_code=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(resp, realm)
        return resp

    @router.get("/sessions", response_model=list[SessionInfo], summary="List active sessions (devices)")
    async def sessions(
        principal: Principal = Depends(require),
        db: AsyncSession = Depends(get_db),
    ) -> list[SessionInfo]:
        rows = await list_active_sessions(db, realm, principal.subject_id)
        return [
            SessionInfo(
                id=s.id,
                user_agent=s.user_agent,
                ip_address=s.ip_address,
                created_at=s.created_at,
                last_used_at=s.last_used_at,
                expires_at=s.expires_at,
                current=s.id == principal.session_id,
            )
            for s in rows
        ]

    @router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Log out one device")
    async def end_session(
        session_id: str,
        principal: Principal = Depends(require),
        db: AsyncSession = Depends(get_db),
    ) -> Response:
        if not await revoke_session(db, session_id, realm, subject_id=principal.subject_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
        resp = Response(status_code=status.HTTP_204_NO_CONTENT)
        if session_id == principal.session_id:
            clear_refresh_cookie(resp, realm)
        return resp

    @router.get("/me", summary="Current profile")
    async def me(
        principal: Principal = Depends(require),
        db: AsyncSession = Depends(get_db),
    ) -> dict:
        profile = await load_profile(db, principal.subject_id)
        if profile is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired.")
        return profile

    return router


user_auth_router = _build_router(
    realm=USER_REALM,
    prefix="/auth",
    tag="Auth",
    require=require_user,
    load_profile=load_user_profile,
    token_model=UserTokenResponse,
)

admin_session_router = _build_router(
    realm=ADMIN_REALM,
    prefix="/admin/auth",
    tag="Admin",
    require=require_admin,
    load_profile=load_admin_profile,
    token_model=AdminTokenResponse,
)
