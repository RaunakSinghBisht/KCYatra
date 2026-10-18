from datetime import date, datetime
from typing import Optional

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
    description: str | None = None
    whatsapp_group_link: str | None = None
    allow_whatsapp_before_payment: bool = False
    status: str = "upcoming"

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not (5 <= len(v) <= 50):
            raise ValueError("title must be between 5 and 50 characters.")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("description must be at most 500 characters.")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"upcoming", "open", "close"}
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


class YatraUpdate(BaseModel):
    title: Optional[str] = None
    start_date: Optional[date] = None
    is_start_date_fixed: Optional[bool] = None
    end_date: Optional[date] = None
    is_end_date_fixed: Optional[bool] = None
    hotel_packages: Optional[list[HotelPackage]] = None
    travel_packages: Optional[list[TravelPackage]] = None
    description: Optional[str] = None
    whatsapp_group_link: Optional[str] = None
    allow_whatsapp_before_payment: Optional[bool] = None
    status: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not (5 <= len(v) <= 50):
                raise ValueError("title must be between 5 and 50 characters.")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("description must be at most 500 characters.")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None:
            allowed = {"upcoming", "open", "close"}
            if v.lower() not in allowed:
                raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
            return v.lower()
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
    description: str | None
    whatsapp_group_link: str | None
    allow_whatsapp_before_payment: bool
    status: str
    created_at: datetime
