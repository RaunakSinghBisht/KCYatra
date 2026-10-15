from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Registration(Base):
    __tablename__ = "registrations"

    __table_args__ = (
        UniqueConstraint("passenger_id", "yatra_id", name="uq_passenger_yatra"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    passenger_id: Mapped[int] = mapped_column(ForeignKey("passengers.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    yatra_id: Mapped[int] = mapped_column(ForeignKey("yatras.id"), nullable=False)
    hotel_package: Mapped[str | None] = mapped_column(String(200), nullable=True)
    travel_package: Mapped[str | None] = mapped_column(String(200), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(20), default="interested", nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 'cash' | 'online'
    transaction_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    passenger: Mapped["Passenger"] = relationship("Passenger", lazy="selectin")  # type: ignore[name-defined]
    user: Mapped["User"] = relationship("User", lazy="selectin")  # type: ignore[name-defined]
    yatra: Mapped["Yatra"] = relationship("Yatra", lazy="selectin")  # type: ignore[name-defined]
