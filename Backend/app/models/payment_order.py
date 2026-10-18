from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PaymentOrder(Base):
    """Server-side record of every checkout order, binding it to the registrations it pays for."""

    __tablename__ = "payment_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    razorpay_order_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    # [{"registration_id": int, "amount_paise": int}, ...] — amounts frozen at order creation
    items: Mapped[list] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="created", nullable=False)  # created | paid
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
