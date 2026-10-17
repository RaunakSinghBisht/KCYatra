from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CarouselImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    position: int
    created_at: datetime


class CarouselReorderRequest(BaseModel):
    ids: list[int]
