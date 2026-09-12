from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator


class HotelPackage(BaseModel):
    title: str
    price: float


class TravelPackage(BaseModel):
    title: str
    price: float


class YatraCreate(BaseModel):
    title: str
    start_date: date
    is_start_date_fixed: bool = True
    end_date: date
    is_end_date_fixed: bool = True
    hotel_packages: list[HotelPackage] | None = None
    travel_packages: list[TravelPackage] | None = None
    message_for_passengers: str | None = None
    whatsapp_group_link: str | None = None
    total_seats: int | None = None
    seats_available: int | None = None

    @field_validator("end_date")
    @classmethod
    def end_date_must_be_after_start(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date must be on or after start_date.")
        return v


class YatraResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    image_url: str | None
    start_date: date
    is_start_date_fixed: bool
    end_date: date
    is_end_date_fixed: bool
    hotel_packages: list[HotelPackage] | None
    travel_packages: list[TravelPackage] | None
    message_for_passengers: str | None
    whatsapp_group_link: str | None
    status: str
    total_seats: int | None
    seats_available: int | None
    created_at: datetime
