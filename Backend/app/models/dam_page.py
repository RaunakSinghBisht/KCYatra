from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DamPage(Base):
    __tablename__ = "dam_page"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    title: Mapped[str] = mapped_column(String(200), default="Website Under Maintenance", nullable=False)
    description: Mapped[str] = mapped_column(
        Text,
        default="We are performing scheduled maintenance to serve you better. Please check back in a little while. Hare Krishna!",
        nullable=False,
    )
    otp_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    accept_payments: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
