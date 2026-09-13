from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class RegistrationCreate(BaseModel):
    passenger_id: int
    user_id: int
    yatra_id: int
    special_requirements: str | None = None
    transaction_id: str | None = None


class RegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    passenger_id: int
    user_id: int
    yatra_id: int
    registration_date: datetime
    status: str
    payment_status: str
    amount_paid: Decimal
    seat_number: str | None
    special_requirements: str | None
    transaction_id: str | None
    created_at: datetime
    updated_at: datetime
