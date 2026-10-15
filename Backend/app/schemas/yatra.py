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
    status: str = "upcoming"

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not (5 <= len(v) <= 50):
            raise ValueError("title must be between 5 and 50 characters.")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"upcoming", "active", "closed"}
        if v.lower() not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return v.lower()

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
    created_at: datetime
