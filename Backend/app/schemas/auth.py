from datetime import datetime

from pydantic import BaseModel


class UserProfile(BaseModel):
    user_id: int
    phone: str


class AdminProfile(BaseModel):
    email: str
    name: str
    role: str


class UserTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfile


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    admin: AdminProfile


class SessionInfo(BaseModel):
    id: str
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    current: bool
