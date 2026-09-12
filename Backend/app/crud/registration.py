from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.registration import Registration
from app.models.traveler import Traveler
from app.models.yatra import Yatra
from app.schemas.registration import RegistrationCreate


class RegistrationError(Exception):
    """Base error for registration business logic failures."""
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class DuplicateRegistrationError(RegistrationError):
    pass


class TravelerNotFoundError(RegistrationError):
    pass


class YatraNotFoundError(RegistrationError):
    pass


class YatraNotActiveError(RegistrationError):
    pass


async def create_registration(db: AsyncSession, data: RegistrationCreate) -> Registration:
    # 1. Verify traveler exists
    traveler = await db.scalar(select(Traveler).where(Traveler.id == data.traveler_id))
    if not traveler:
        raise TravelerNotFoundError(f"Traveler with id={data.traveler_id} not found.")

    # 2. Verify yatra exists and is not cancelled/completed
    yatra = await db.scalar(select(Yatra).where(Yatra.id == data.yatra_id))
    if not yatra:
        raise YatraNotFoundError(f"Yatra with id={data.yatra_id} not found.")
    if yatra.status in ("cancelled", "completed"):
        raise YatraNotActiveError(
            f"Cannot register for a yatra with status '{yatra.status}'."
        )

    # 3. Determine registration status based on seat availability
    reg_status = "pending"
    if yatra.seats_available is not None:
        if yatra.seats_available > 0:
            # Decrement seats inside this same transaction
            yatra.seats_available -= 1
        else:
            reg_status = "waitlisted"

    # 4. Insert registration row (UNIQUE constraint handles race conditions as fallback)
    registration = Registration(
        traveler_id=data.traveler_id,
        yatra_id=data.yatra_id,
        special_requirements=data.special_requirements,
        status=reg_status,
    )
    db.add(registration)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateRegistrationError(
            f"Traveler {data.traveler_id} is already registered for Yatra {data.yatra_id}."
        )

    await db.refresh(registration)
    return registration


async def get_registrations_by_yatra(db: AsyncSession, yatra_id: int) -> list[Registration]:
    result = await db.execute(
        select(Registration).where(Registration.yatra_id == yatra_id)
    )
    return list(result.scalars().all())


async def get_registrations_by_traveler(db: AsyncSession, traveler_id: int) -> list[Registration]:
    result = await db.execute(
        select(Registration).where(Registration.traveler_id == traveler_id)
    )
    return list(result.scalars().all())
