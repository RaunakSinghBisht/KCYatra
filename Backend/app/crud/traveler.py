from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.traveler import Traveler
from app.schemas.traveler import TravelerCreate


class DuplicateTravelerError(Exception):
    """Raised when email or phone already exists in the DB."""
    def __init__(self, field: str) -> None:
        self.field = field
        super().__init__(f"Traveler with this {field} already exists.")


async def create_traveler(db: AsyncSession, data: TravelerCreate) -> Traveler:
    # Check for duplicate phone
    existing_phone = await db.scalar(
        select(Traveler).where(Traveler.phone == data.phone)
    )
    if existing_phone:
        raise DuplicateTravelerError("phone")

    # Check for duplicate email (only if provided)
    if data.email:
        existing_email = await db.scalar(
            select(Traveler).where(Traveler.email == data.email)
        )
        if existing_email:
            raise DuplicateTravelerError("email")

    traveler = Traveler(**data.model_dump())
    db.add(traveler)
    await db.commit()
    await db.refresh(traveler)
    return traveler
