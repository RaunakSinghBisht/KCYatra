from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Registration(Base):
    __tablename__ = "registrations"

    __table_args__ = (
        UniqueConstraint("traveler_id", "yatra_id", name="uq_traveler_yatra"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    traveler_id: Mapped[int] = mapped_column(ForeignKey("travelers.id"), nullable=False)
    yatra_id: Mapped[int] = mapped_column(ForeignKey("yatras.id"), nullable=False)
    registration_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid", nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    seat_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    special_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships (lazy="selectin" avoids extra queries in async context)
    traveler: Mapped["Traveler"] = relationship("Traveler", lazy="selectin")  # type: ignore[name-defined]
    yatra: Mapped["Yatra"] = relationship("Yatra", lazy="selectin")  # type: ignore[name-defined]
