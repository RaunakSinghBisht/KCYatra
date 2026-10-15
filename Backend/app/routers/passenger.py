from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.passenger import (
    create_passenger,
    delete_passenger,
    get_passengers_by_user,
    update_passenger,
    has_passenger_registrations,
)
from app.dependencies.db import get_db
from app.schemas.passenger import PassengerCreate, PassengerResponse

router = APIRouter(prefix="/passengers", tags=["Passengers"])


@router.post(
    "/",
    response_model=PassengerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a passenger (linked to a user account)",
)
async def add_passenger(
    payload: PassengerCreate,
    db: AsyncSession = Depends(get_db),
) -> PassengerResponse:
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
    db: AsyncSession = Depends(get_db),
) -> list[PassengerResponse]:
    return await get_passengers_by_user(db, user_id)


@router.put(
    "/{passenger_id}",
    response_model=PassengerResponse,
    summary="Update a passenger's details",
)
async def edit_passenger(
    passenger_id: int,
    payload: PassengerCreate,
    db: AsyncSession = Depends(get_db),
) -> PassengerResponse:
    passenger = await update_passenger(db, passenger_id, payload)
    if not passenger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Passenger with id={passenger_id} not found.",
        )
    return passenger


@router.delete(
    "/{passenger_id}",
    response_model=dict,
    summary="Delete a passenger",
)
async def remove_passenger(
    passenger_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
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
    db: AsyncSession = Depends(get_db),
) -> dict:
    has_regs = await has_passenger_registrations(db, passenger_id)
    return {"has_registrations": has_regs}
