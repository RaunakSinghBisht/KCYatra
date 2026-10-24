"""
Request authentication.

    principal: Principal = Depends(get_principal)   # any logged-in user or admin
    principal: Principal = Depends(require_user)    # customers only
    dependencies=[Depends(require_admin)]           # admin-only endpoint
    ensure_owner(principal, record.user_id)         # user may only touch their own data; admin may touch all
"""

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_active_session
from app.core.config import settings
from app.core.security import ACCESS, decode_token
from app.dependencies.db import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

ADMIN_NAME = "Yatra Admin"
ADMIN_ROLE_LABEL = "Super Admin"


@dataclass
class Principal:
    role: str  # "user" | "admin"
    subject_id: str
    session_id: str
    user: User | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def user_id(self) -> int:
        assert self.user is not None
        return self.user.id


def _unauthorized(detail: str = "Not authenticated.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    claims = decode_token(credentials.credentials, ACCESS)
    if claims is None:
        raise _unauthorized("Session expired. Please log in again.")

    session = await get_active_session(db, claims["sid"])
    if session is None or session.subject_id != claims["sub"] or session.subject_type != claims.get("role"):
        raise _unauthorized("Session expired. Please log in again.")

    if session.subject_type == "admin":
        if not settings.ADMIN_EMAIL or session.subject_id != settings.ADMIN_EMAIL.strip().lower():
            raise _unauthorized("Session expired. Please log in again.")
        return Principal(role="admin", subject_id=session.subject_id, session_id=session.id)

    if session.subject_type == "user":
        try:
            user = await db.get(User, int(session.subject_id))
        except ValueError:
            user = None
        if user is None:
            raise _unauthorized("Session expired. Please log in again.")
        return Principal(role="user", subject_id=session.subject_id, session_id=session.id, user=user)

    raise _unauthorized()


async def require_user(principal: Principal = Depends(get_principal)) -> Principal:
    if principal.role != "user":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This action is for customer accounts.")
    return principal


async def require_admin(principal: Principal = Depends(get_principal)) -> Principal:
    if not principal.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return principal


def ensure_owner(principal: Principal, owner_user_id: int | None) -> None:
    """Admins may access everything; a user only records whose user_id is their own."""
    if principal.is_admin:
        return
    if principal.user is None or owner_user_id != principal.user.id:
        # 404 rather than 403 so ids of other people's records aren't confirmed.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
