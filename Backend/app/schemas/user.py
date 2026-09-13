import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


_PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")


class UserCreate(BaseModel):
    full_name: str
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not _PHONE_RE.match(v):
            raise ValueError("Invalid phone number format.")
        return v


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone: str
    created_at: datetime
    updated_at: datetime
