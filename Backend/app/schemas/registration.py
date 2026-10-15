from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class RegistrationCreate(BaseModel):
    passenger_id: int
    user_id: int
    yatra_id: int
    hotel_package: str | None = None
    travel_package: str | None = None
    transaction_id: str | None = None


class RegistrationPackageUpdate(BaseModel):
    """Used to PATCH hotel/travel packages on an existing registration."""
    hotel_package: str | None = None
    travel_package: str | None = None


class RegistrationCashRequest(BaseModel):
    registration_ids: list[int]


class RegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    passenger_id: int
    user_id: int
    yatra_id: int
    hotel_package: str | None
    travel_package: str | None
    payment_status: str
    amount_paid: Decimal
    payment_method: str | None  # 'cash' | 'online'
    transaction_id: str | None
    created_at: datetime
    updated_at: datetime


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_status: str
    transaction_id: str | None
    hotel_package: str | None
    travel_package: str | None
    amount_paid: Decimal
    payment_method: str | None
    created_at: datetime

    # Computed Passenger ID
    passenger_id_formatted: str

    # Passenger fields
    passenger_name: str
    passenger_gender: str
    passenger_yob: int

    # Yatra fields
    yatra_title: str
    yatra_start_date: datetime
    yatra_whatsapp_link: str | None
