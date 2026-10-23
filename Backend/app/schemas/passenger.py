from datetime import datetime

from pydantic import BaseModel, ConfigDict, ValidationInfo, field_validator


class PassengerCreate(BaseModel):
    user_id: int
    full_name: str
    gender: str
    year_of_birth: int
    special_assistance: str = "Not Required"
    state: str
    district: str
    city: str
    phone_no: str | None = None

    @field_validator("special_assistance")
    @classmethod
    def validate_special_assistance(cls, v: str) -> str:
        if len(v.strip()) > 200:
            raise ValueError("special_assistance must be at most 200 characters.")
        return v.strip()

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if not (3 <= len(v) <= 50):
            raise ValueError("full_name must be between 3 and 50 characters.")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        allowed = {"male", "female", "other"}
        if v.lower() not in allowed:
            raise ValueError(f"gender must be one of: {', '.join(sorted(allowed))}")
        return v.lower()

    @field_validator("year_of_birth")
    @classmethod
    def validate_year_of_birth(cls, v: int) -> int:
        if not (1900 <= v <= 2100):
            raise ValueError("year_of_birth must be a valid year between 1900 and 2100.")
        return v

    @field_validator("state", "district", "city")
    @classmethod
    def validate_address_field(cls, v: str, info: ValidationInfo) -> str:
        v = v.strip()
        if not v:
            raise ValueError(f"{info.field_name} is required.")
        if len(v) > 100:
            raise ValueError(f"{info.field_name} must be at most 100 characters.")
        return v

    @field_validator("phone_no")
    @classmethod
    def validate_phone_no(cls, v: str | None) -> str | None:
        if v is None:
            return None
        digits = v.strip().replace(" ", "")
        if not digits.isdigit() or len(digits) != 10:
            raise ValueError("phone_no must be exactly 10 digits.")
        return digits


class PassengerUpdate(BaseModel):
    full_name: str | None = None
    gender: str | None = None
    year_of_birth: int | None = None
    special_assistance: str | None = None
    state: str | None = None
    district: str | None = None
    city: str | None = None
    phone_no: str | None = None

    @field_validator("special_assistance")
    @classmethod
    def validate_special_assistance(cls, v: str | None) -> str | None:
        if v is not None and len(v.strip()) > 200:
            raise ValueError("special_assistance must be at most 200 characters.")
        return v.strip() if v else None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not (3 <= len(v) <= 50):
            raise ValueError("full_name must be between 3 and 50 characters.")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        if v is None:
            return None
        allowed = {"male", "female", "other"}
        if v.lower() not in allowed:
            raise ValueError(f"gender must be one of: {', '.join(sorted(allowed))}")
        return v.lower()

    @field_validator("year_of_birth")
    @classmethod
    def validate_year_of_birth(cls, v: int | None) -> int | None:
        if v is not None and not (1900 <= v <= 2100):
            raise ValueError("year_of_birth must be a valid year between 1900 and 2100.")
        return v

    # Omitted / null = leave the stored value unchanged; a blank string is rejected.
    @field_validator("state", "district", "city")
    @classmethod
    def validate_address_field(cls, v: str | None, info: ValidationInfo) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError(f"{info.field_name} cannot be empty.")
        if len(v) > 100:
            raise ValueError(f"{info.field_name} must be at most 100 characters.")
        return v

    @field_validator("phone_no")
    @classmethod
    def validate_phone_no(cls, v: str | None) -> str | None:
        if v is None:
            return None
        digits = v.strip().replace(" ", "")
        if digits == "":
            return None
        if not digits.isdigit() or len(digits) != 10:
            raise ValueError("phone_no must be exactly 10 digits.")
        return digits


class PassengerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    full_name: str
    gender: str
    year_of_birth: int
    special_assistance: str
    state: str | None
    district: str | None
    city: str | None
    phone_no: str | None
    created_at: datetime
    is_deleted: bool = False
    login_phone: str | None = None
    bookings_count: int = 0


class PassengerAdminResponse(PassengerResponse):
    pass
