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


class AdminRegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    passenger_id: int
    user_id: int
    yatra_id: int
    hotel_package: str | None
    travel_package: str | None
    payment_status: str
    amount_paid: Decimal
    payment_method: str | None
    transaction_id: str | None
    created_at: datetime
    updated_at: datetime

    # Joined fields — passenger
    passenger_name: str
    passenger_gender: str
    passenger_yob: int
    passenger_phone: str | None
    passenger_city: str | None
    passenger_district: str | None
    passenger_state: str | None
    passenger_special_assistance: str | None
    # Joined fields — yatra & user
    yatra_title: str
    user_phone: str | None


class AdminManualBookingCreate(BaseModel):
    """Admin manual booking — create passenger (if needed) + registration in one call."""
    passenger_id: int | None = None
    # New passenger fields (used when passenger_id is None)
    login_phone: str | None = None
    full_name: str | None = None
    gender: str = "male"
    year_of_birth: int | None = None
    phone_no: str | None = None
    state: str | None = None
    district: str | None = None
    city: str | None = None
    special_assistance: str = "Not Required"
    # Registration fields
    yatra_id: int
    hotel_package: str | None = None
    travel_package: str | None = None
    payment_status: str = "interested"
    amount_paid: float = 0.0
    payment_method: str | None = None
    transaction_id: str | None = None


class AdminRegistrationUpdate(BaseModel):
    hotel_package: str | None = None
    travel_package: str | None = None
    payment_status: str | None = None
    amount_paid: float | None = None
    payment_method: str | None = None
    transaction_id: str | None = None


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
