import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class UserCreate(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if len(v) not in (10, 13):
            raise ValueError("phone must be exactly 10 digits or 13 characters (with country code).")
        if not re.fullmatch(r"\+?\d+", v):
            raise ValueError("phone must contain only digits (optionally prefixed with +).")
        return v


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    created_at: datetime
    updated_at: datetime
