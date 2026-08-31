import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


_PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")


class TravelerCreate(BaseModel):
    full_name: str
    email: EmailStr | None = None
    phone: str
    gender: str
    dob: date | None = None
    state: str
    district: str
    aadhar: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not _PHONE_RE.match(v):
            raise ValueError("Invalid phone number format.")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        allowed = {"male", "female", "other"}
        if v.lower() not in allowed:
            raise ValueError(f"gender must be one of: {', '.join(allowed)}")
        return v.lower()


class TravelerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str | None
    phone: str
    gender: str
    dob: date | None
    state: str
    district: str
    aadhar: str | None
    created_at: datetime
