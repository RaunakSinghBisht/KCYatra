from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DamPageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    enabled: bool
    title: str
    description: str
    otp_enabled: bool
    accept_payments: bool
    updated_at: datetime


class DamPageUpdate(BaseModel):
    enabled: bool | None = None
    title: str | None = None
    description: str | None = None
    otp_enabled: bool | None = None
    accept_payments: bool | None = None
