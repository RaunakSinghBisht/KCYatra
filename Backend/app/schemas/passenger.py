from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class PassengerCreate(BaseModel):
    user_id: int
    full_name: str
    gender: str
    year_of_birth: int
    special_assistance: str = "Not Required"
    state: str | None = None
    city: str | None = None
    aadhaar_no: str | None = None

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        allowed = {"male", "female"}
        if v.lower() not in allowed:
            raise ValueError(f"gender must be one of: {', '.join(allowed)}")
        return v.lower()

    @field_validator("year_of_birth")
    @classmethod
    def validate_year_of_birth(cls, v: int) -> int:
        if not (1900 <= v <= 2100):
            raise ValueError("year_of_birth must be a valid year between 1900 and 2100.")
        return v


class PassengerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    full_name: str
    gender: str
    year_of_birth: int
    special_assistance: str
    state: str | None
    city: str | None
    aadhaar_no: str | None
    created_at: datetime
