from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.passenger import (
    create_passenger,
    delete_passenger,
    get_all_passengers,
    get_passengers_by_user,
    update_passenger,
    has_passenger_registrations,
)
from app.dependencies.auth import Principal, ensure_owner, get_principal, require_admin, require_user
from app.dependencies.db import get_db
from app.models.passenger import Passenger
from app.schemas.passenger import (
    PassengerAdminResponse,
    PassengerCreate,
    PassengerResponse,
    PassengerUpdate,
)

router = APIRouter(prefix="/passengers", tags=["Passengers"])


async def _owned_passenger(db: AsyncSession, passenger_id: int, principal: Principal) -> Passenger:
    passenger = await db.get(Passenger, passenger_id)
    if passenger is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Passenger with id={passenger_id} not found.",
        )
    ensure_owner(principal, passenger.user_id)
    return passenger


@router.get(
    "/",
    response_model=list[PassengerAdminResponse],
    summary="List all passengers for admin management",
    dependencies=[Depends(require_admin)],
)
async def list_all_passengers(
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
) -> list[PassengerAdminResponse]:
    return await get_all_passengers(db, include_deleted=include_deleted)


@router.post(
    "/",
    response_model=PassengerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a passenger (linked to a user account)",
)
async def add_passenger(
    payload: PassengerCreate,
    principal: Principal = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> PassengerResponse:
    # Passengers always belong to the logged-in account, whatever user_id was sent.
    payload = payload.model_copy(update={"user_id": principal.user_id})
    try:
        passenger = await create_passenger(db, payload)
        return passenger
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.get(
    "/user/{user_id}",
    response_model=list[PassengerResponse],
    summary="List all passengers added by a specific user",
)
async def list_passengers_by_user(
    user_id: int,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> list[PassengerResponse]:
    ensure_owner(principal, user_id)
    return await get_passengers_by_user(db, user_id)


@router.put(
    "/{passenger_id}",
    response_model=PassengerAdminResponse,
    summary="Update a passenger's details",
)
async def edit_passenger(
    passenger_id: int,
    payload: PassengerUpdate,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> PassengerAdminResponse:
    await _owned_passenger(db, passenger_id, principal)
    passenger = await update_passenger(db, passenger_id, payload)
    if not passenger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Passenger with id={passenger_id} not found.",
        )
    has_regs = await has_passenger_registrations(db, passenger_id)
    login_phone = passenger.user.phone if passenger.user else None
    return PassengerAdminResponse(
        id=passenger.id,
        user_id=passenger.user_id,
        full_name=passenger.full_name,
        gender=passenger.gender,
        year_of_birth=passenger.year_of_birth,
        special_assistance=passenger.special_assistance,
        state=passenger.state,
        district=passenger.district,
        city=passenger.city,
        phone_no=passenger.phone_no,
        created_at=passenger.created_at,
        is_deleted=passenger.is_deleted,
        login_phone=login_phone,
        bookings_count=1 if has_regs else 0,
    )


@router.delete(
    "/{passenger_id}",
    response_model=dict,
    summary="Delete a passenger",
)
async def remove_passenger(
    passenger_id: int,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _owned_passenger(db, passenger_id, principal)
    deleted = await delete_passenger(db, passenger_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Passenger with id={passenger_id} not found.",
        )
    return {"message": "Passenger deleted successfully"}

@router.get(
    "/{passenger_id}/has-registrations",
    response_model=dict,
    summary="Check if a passenger has any yatra registrations",
)
async def check_passenger_registrations(
    passenger_id: int,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await _owned_passenger(db, passenger_id, principal)
    has_regs = await has_passenger_registrations(db, passenger_id)
    return {"has_registrations": has_regs}
