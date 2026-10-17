from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.passenger import Passenger
from app.schemas.passenger import PassengerCreate, PassengerUpdate


async def create_passenger(db: AsyncSession, data: PassengerCreate) -> Passenger:
    passenger = Passenger(**data.model_dump())
    db.add(passenger)
    await db.commit()
    await db.refresh(passenger)
    return passenger


async def get_all_passengers(
    db: AsyncSession, include_deleted: bool = False
) -> list[dict]:
    from app.models.registration import Registration
    from app.models.user import User

    # Subquery: latest transaction_id per passenger (by highest registration id)
    latest_txn = (
        select(Registration.transaction_id)
        .where(Registration.passenger_id == Passenger.id)
        .order_by(Registration.id.desc())
        .limit(1)
        .correlate(Passenger)
        .scalar_subquery()
    )

    stmt = (
        select(
            Passenger,
            User.phone.label("login_phone"),
            func.count(Registration.id).label("bookings_count"),
            latest_txn.label("latest_transaction_id"),
        )
        .outerjoin(User, Passenger.user_id == User.id)
        .outerjoin(Registration, Registration.passenger_id == Passenger.id)
    )
    if not include_deleted:
        stmt = stmt.where(Passenger.is_deleted == False)

    stmt = stmt.group_by(Passenger.id, User.phone).order_by(Passenger.id.desc())

    result = await db.execute(stmt)
    records = []
    for passenger, login_phone, bookings_count, latest_transaction_id in result.all():
        records.append({
            "id": passenger.id,
            "user_id": passenger.user_id,
            "full_name": passenger.full_name,
            "gender": passenger.gender,
            "year_of_birth": passenger.year_of_birth,
            "special_assistance": passenger.special_assistance,
            "state": passenger.state,
            "district": passenger.district,
            "city": passenger.city,
            "phone_no": passenger.phone_no,
            "created_at": passenger.created_at,
            "is_deleted": passenger.is_deleted,
            "login_phone": login_phone,
            "bookings_count": bookings_count or 0,
            "latest_transaction_id": latest_transaction_id,
        })
    return records


async def get_passengers_by_user(db: AsyncSession, user_id: int) -> list[Passenger]:
    result = await db.execute(
        select(Passenger).where(
            Passenger.user_id == user_id,
            Passenger.is_deleted == False
        )
    )
    return list(result.scalars().all())


async def update_passenger(
    db: AsyncSession, passenger_id: int, data: PassengerCreate | PassengerUpdate | dict
) -> Passenger | None:
    passenger = await db.scalar(select(Passenger).where(Passenger.id == passenger_id))
    if not passenger:
        return None
    dump = (
        data
        if isinstance(data, dict)
        else data.model_dump(exclude_unset=True, exclude={"user_id"})
    )
    for field, value in dump.items():
        if hasattr(passenger, field) and value is not None:
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
