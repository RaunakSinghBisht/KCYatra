from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.passenger import Passenger
from app.models.registration import Registration
from app.models.user import User
from app.models.yatra import Yatra
from app.schemas.registration import AdminManualBookingCreate, RegistrationCreate, RegistrationPackageUpdate


class RegistrationError(Exception):
    """Base error for registration business logic failures."""
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class DuplicateRegistrationError(RegistrationError):
    pass


class PassengerNotFoundError(RegistrationError):
    pass


class UserNotFoundError(RegistrationError):
    pass


class YatraNotFoundError(RegistrationError):
    pass


class YatraNotActiveError(RegistrationError):
    pass


async def create_registration(db: AsyncSession, data: RegistrationCreate) -> Registration:
    # 1. Verify passenger exists
    passenger = await db.scalar(select(Passenger).where(Passenger.id == data.passenger_id))
    if not passenger:
        raise PassengerNotFoundError(f"Passenger with id={data.passenger_id} not found.")

    # 2. Verify user (booking account) exists
    user = await db.scalar(select(User).where(User.id == data.user_id))
    if not user:
        raise UserNotFoundError(f"User with id={data.user_id} not found.")

    # 3. Verify yatra exists and is bookable
    yatra = await db.scalar(select(Yatra).where(Yatra.id == data.yatra_id))
    if not yatra:
        raise YatraNotFoundError(f"Yatra with id={data.yatra_id} not found.")
    if yatra.status == "closed":
        raise YatraNotActiveError(f"Cannot register for a yatra with status '{yatra.status}'.")

    # 4. Insert registration row (UNIQUE constraint handles race conditions as fallback)
    registration = Registration(
        passenger_id=data.passenger_id,
        user_id=data.user_id,
        yatra_id=data.yatra_id,
        hotel_package=data.hotel_package,
        travel_package=data.travel_package,
        transaction_id=data.transaction_id,
    )
    db.add(registration)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateRegistrationError(
            f"Passenger {data.passenger_id} is already registered for Yatra {data.yatra_id}."
        )

    await db.refresh(registration)
    return registration


async def update_registration_packages(
    db: AsyncSession,
    registration_id: int,
    data: RegistrationPackageUpdate,
) -> Registration | None:
    """Update hotel/travel packages on an existing registration row."""
    reg = await db.scalar(select(Registration).where(Registration.id == registration_id))
    if not reg:
        return None

    if data.hotel_package is not None:
        reg.hotel_package = data.hotel_package
    if data.travel_package is not None:
        reg.travel_package = data.travel_package

    await db.commit()
    await db.refresh(reg)
    return reg


async def get_registration_by_passenger_and_yatra(
    db: AsyncSession,
    passenger_id: int,
    yatra_id: int,
) -> Registration | None:
    return await db.scalar(
        select(Registration).where(
            Registration.passenger_id == passenger_id,
            Registration.yatra_id == yatra_id,
        )
    )


async def get_registrations_by_yatra(db: AsyncSession, yatra_id: int) -> list[Registration]:
    result = await db.execute(
        select(Registration).where(Registration.yatra_id == yatra_id)
    )
    return list(result.scalars().all())


async def get_registrations_by_user(db: AsyncSession, user_id: int) -> list[Registration]:
    result = await db.execute(
        select(Registration).where(Registration.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_registrations_by_passenger(
    db: AsyncSession, passenger_id: int
) -> list[Registration]:
    result = await db.execute(
        select(Registration).where(Registration.passenger_id == passenger_id)
    )
    return list(result.scalars().all())


async def update_registration_payment(
    db: AsyncSession,
    registration_id: int,
    transaction_id: str,
    amount_paid: float,
) -> Registration | None:
    """Mark a registration as paid after successful Razorpay payment."""
    reg = await db.scalar(select(Registration).where(Registration.id == registration_id))
    if not reg:
        return None

    reg.payment_status = "paid"
    reg.transaction_id = transaction_id
    reg.amount_paid = amount_paid  # type: ignore[assignment]
    reg.payment_method = "online"

    await db.commit()
    await db.refresh(reg)
    return reg


async def mark_registrations_as_cash(
    db: AsyncSession,
    registration_ids: list[int],
) -> list[int]:
    """Mark multiple registrations for cash payment."""
    updated_ids = []
    for reg_id in registration_ids:
        reg = await db.scalar(select(Registration).where(Registration.id == reg_id))
        if reg:
            reg.payment_method = "cash"
            reg.payment_status = "not_paid"
            reg.amount_paid = 0  # type: ignore[assignment]
            reg.transaction_id = None
            updated_ids.append(reg_id)
    
    if updated_ids:
        await db.commit()
    
    return updated_ids


async def get_all_registrations_admin(db: AsyncSession) -> list[dict]:
    """Admin view: all registrations with joined passenger, user, and yatra data."""
    stmt = (
        select(
            Registration.id,
            Registration.passenger_id,
            Registration.user_id,
            Registration.yatra_id,
            Registration.hotel_package,
            Registration.travel_package,
            Registration.payment_status,
            Registration.amount_paid,
            Registration.payment_method,
            Registration.transaction_id,
            Registration.created_at,
            Registration.updated_at,
            Passenger.full_name.label("passenger_name"),
            Passenger.gender.label("passenger_gender"),
            Passenger.year_of_birth.label("passenger_yob"),
            Passenger.phone_no.label("passenger_phone"),
            Passenger.city.label("passenger_city"),
            Passenger.district.label("passenger_district"),
            Passenger.state.label("passenger_state"),
            Passenger.special_assistance.label("passenger_special_assistance"),
            Yatra.title.label("yatra_title"),
            User.phone.label("user_phone"),
        )
        .join(Passenger, Registration.passenger_id == Passenger.id)
        .join(Yatra, Registration.yatra_id == Yatra.id)
        .outerjoin(User, Registration.user_id == User.id)
        .order_by(Registration.created_at.desc())
    )
    result = await db.execute(stmt)
    return [dict(row._mapping) for row in result.all()]


async def delete_registration(db: AsyncSession, registration_id: int) -> bool:
    """Hard delete a registration."""
    reg = await db.scalar(select(Registration).where(Registration.id == registration_id))
    if not reg:
        return False
    await db.delete(reg)
    await db.commit()
    return True


async def admin_update_registration(
    db: AsyncSession,
    registration_id: int,
    hotel_package: str | None,
    travel_package: str | None,
    payment_status: str | None,
    amount_paid: float | None,
    payment_method: str | None,
    transaction_id: str | None,
) -> Registration | None:
    """Admin: update any editable field on a registration."""
    reg = await db.scalar(select(Registration).where(Registration.id == registration_id))
    if not reg:
        return None
    if hotel_package is not None:
        reg.hotel_package = hotel_package
    if travel_package is not None:
        reg.travel_package = travel_package
    if payment_status is not None:
        reg.payment_status = payment_status
    if amount_paid is not None:
        reg.amount_paid = amount_paid  # type: ignore[assignment]
    if payment_method is not None:
        reg.payment_method = payment_method
    if transaction_id is not None:
        reg.transaction_id = transaction_id
    await db.commit()
    await db.refresh(reg)
    return reg


async def admin_manual_create_registration(
    db: AsyncSession,
    data: AdminManualBookingCreate,
) -> Registration:
    """Admin-only: create a passenger (if needed) + registration, bypassing yatra status check."""
    from app.crud.user import get_or_create_user_by_phone

    # Verify yatra exists (no status check — admin can book for closed yatras)
    yatra = await db.scalar(select(Yatra).where(Yatra.id == data.yatra_id, Yatra.is_deleted == False))  # noqa: E712
    if not yatra:
        raise YatraNotFoundError(f"Yatra with id={data.yatra_id} not found.")

    # Resolve or create passenger
    if data.passenger_id is not None:
        passenger = await db.scalar(select(Passenger).where(Passenger.id == data.passenger_id))
        if not passenger:
            raise PassengerNotFoundError(f"Passenger with id={data.passenger_id} not found.")
        user_id = passenger.user_id
    else:
        if not data.full_name or not data.year_of_birth:
            raise RegistrationError("full_name and year_of_birth are required for a new passenger.")
        phone = (data.login_phone or "").strip() or "0000000000"
        user = await get_or_create_user_by_phone(db, phone)
        passenger = Passenger(
            user_id=user.id,
            full_name=data.full_name.strip(),
            gender=data.gender or "male",
            year_of_birth=data.year_of_birth,
            phone_no=data.phone_no or None,
            state=data.state or None,
            district=data.district or None,
            city=data.city or None,
            special_assistance=data.special_assistance or "Not Required",
        )
        db.add(passenger)
        await db.flush()
        user_id = user.id

    # Duplicate check
    existing = await db.scalar(
        select(Registration).where(
            Registration.passenger_id == passenger.id,
            Registration.yatra_id == data.yatra_id,
        )
    )
    if existing:
        raise DuplicateRegistrationError(
            f"Passenger {passenger.full_name} is already registered for this yatra."
        )

    registration = Registration(
        passenger_id=passenger.id,
        user_id=user_id,
        yatra_id=data.yatra_id,
        hotel_package=data.hotel_package,
        travel_package=data.travel_package,
        payment_status=data.payment_status,
        amount_paid=data.amount_paid,  # type: ignore[arg-type]
        payment_method=data.payment_method,
        transaction_id=data.transaction_id,
    )
    db.add(registration)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateRegistrationError(
            f"Passenger {passenger.full_name} is already registered for this yatra."
        )
    await db.refresh(registration)
    return registration


async def get_user_bookings(db: AsyncSession, user_id: int) -> list[dict]:
    """Get all bookings for a user with joined passenger and yatra fields."""
    stmt = (
        select(
            Registration.id,
            Registration.payment_status,
            Registration.transaction_id,
            Registration.hotel_package,
            Registration.travel_package,
            Registration.amount_paid,
            Registration.payment_method,
            Registration.created_at,
            Passenger.id.label("passenger_id"),
            Passenger.full_name.label("passenger_name"),
            Passenger.gender.label("passenger_gender"),
            Passenger.year_of_birth.label("passenger_yob"),
            Yatra.title.label("yatra_title"),
            Yatra.start_date.label("yatra_start_date"),
            Yatra.whatsapp_group_link.label("yatra_whatsapp_link"),
        )
        .join(Passenger, Registration.passenger_id == Passenger.id)
        .join(Yatra, Registration.yatra_id == Yatra.id)
        .where(Registration.user_id == user_id)
        .order_by(Registration.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    bookings = []
    for row in rows:
        bookings.append({
            "id": row.id,
            "payment_status": row.payment_status,
            "transaction_id": row.transaction_id,
            "hotel_package": row.hotel_package,
            "travel_package": row.travel_package,
            "amount_paid": row.amount_paid,
            "payment_method": row.payment_method,
            "created_at": row.created_at,
            "passenger_id_formatted": f"PSG{row.passenger_id:05d}",
            "passenger_name": row.passenger_name,
            "passenger_gender": row.passenger_gender,
            "passenger_yob": row.passenger_yob,
            "yatra_title": row.yatra_title,
            "yatra_start_date": row.yatra_start_date,
            "yatra_whatsapp_link": row.yatra_whatsapp_link,
        })
    return bookings
