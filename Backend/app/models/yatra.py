from datetime import date, datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Yatra(Base):
    __tablename__ = "yatras"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    start_date: Mapped[date] = mapped_column(nullable=False)
    is_start_date_fixed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    end_date: Mapped[date] = mapped_column(nullable=False)
    is_end_date_fixed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    hotel_packages: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    travel_packages: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    message_for_passengers: Mapped[str | None] = mapped_column(Text, nullable=True)
    whatsapp_group_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="upcoming", nullable=False)
    total_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seats_available: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
