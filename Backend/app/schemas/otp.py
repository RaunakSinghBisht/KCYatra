from pydantic import BaseModel, field_validator


class OtpSendRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = v.replace("+91", "").strip()
        if not digits.isdigit() or len(digits) != 10:
            raise ValueError("Phone must be a 10-digit number (with or without +91).")
        return digits  # always store/return plain 10 digits


class OtpSendResponse(BaseModel):
    message: str
    # True when bypass mode is active — lets frontend show a hint
    bypass_active: bool = False


class OtpVerifyRequest(BaseModel):
    phone: str
    otp: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = v.replace("+91", "").strip()
        if not digits.isdigit() or len(digits) != 10:
            raise ValueError("Phone must be a 10-digit number (with or without +91).")
        return digits

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not v.strip().isdigit() or len(v.strip()) != 6:
            raise ValueError("OTP must be exactly 6 digits.")
        return v.strip()


class OtpVerifyResponse(BaseModel):
    verified: bool
    message: str
    # Populated on success — used by frontend to sign the user in
    user_id: int | None = None
    phone: str | None = None
