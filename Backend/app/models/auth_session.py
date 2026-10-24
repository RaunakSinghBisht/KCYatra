from datetime import datetime

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuthSession(Base):
    """One logged-in device. Refresh tokens rotate within a session; revoking it logs that device out."""

    __tablename__ = "auth_sessions"
    __table_args__ = (Index("ix_auth_sessions_subject", "subject_type", "subject_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    subject_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "user" | "admin"
    subject_id: Mapped[str] = mapped_column(String(255), nullable=False)  # user id or admin email
    refresh_jti: Mapped[str] = mapped_column(String(64), nullable=False)  # the only valid refresh token
    previous_jti: Mapped[str | None] = mapped_column(String(64), nullable=True)  # valid for a short grace window
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
