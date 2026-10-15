from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.passenger import Passenger
from app.schemas.passenger import PassengerCreate


async def create_passenger(db: AsyncSession, data: PassengerCreate) -> Passenger:
    passenger = Passenger(**data.model_dump())
    db.add(passenger)
    await db.commit()
    await db.refresh(passenger)
    return passenger


async def get_passengers_by_user(db: AsyncSession, user_id: int) -> list[Passenger]:
    result = await db.execute(
        select(Passenger).where(
            Passenger.user_id == user_id,
            Passenger.is_deleted == False
        )
    )
    return list(result.scalars().all())


async def update_passenger(
    db: AsyncSession, passenger_id: int, data: PassengerCreate
) -> Passenger | None:
    passenger = await db.scalar(select(Passenger).where(Passenger.id == passenger_id))
    if not passenger:
        return None
    for field, value in data.model_dump(exclude={"user_id"}).items():
        setattr(passenger, field, value)
    await db.commit()
    await db.refresh(passenger)
    return passenger


async def delete_passenger(db: AsyncSession, passenger_id: int) -> bool:
    passenger = await db.scalar(select(Passenger).where(Passenger.id == passenger_id))
    if not passenger:
        return False
    passenger.is_deleted = True
    await db.commit()
    return True

async def has_passenger_registrations(db: AsyncSession, passenger_id: int) -> bool:
    from app.models.registration import Registration
    count = await db.scalar(
        select(func.count(Registration.id)).where(Registration.passenger_id == passenger_id)
    )
    return count > 0
