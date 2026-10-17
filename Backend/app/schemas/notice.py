from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class NoticeCreate(BaseModel):
    title: str
    body: str
    sender_name: str = "Yatra Admin"
    tag: str = "General"
    is_published: bool = True

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty.")
        if len(v) > 200:
            raise ValueError("title must be at most 200 characters.")
        return v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("body cannot be empty.")
        return v

    @field_validator("sender_name")
    @classmethod
    def validate_sender(cls, v: str) -> str:
        return v.strip() or "Yatra Admin"

    @field_validator("tag")
    @classmethod
    def validate_tag(cls, v: str) -> str:
        return v.strip() or "General"


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    sender_name: Optional[str] = None
    tag: Optional[str] = None
    is_published: Optional[bool] = None


class NoticeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    sender_name: str
    tag: str
    is_published: bool
    created_at: datetime
    updated_at: datetime
