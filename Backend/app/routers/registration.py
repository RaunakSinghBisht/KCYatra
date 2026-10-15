from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.registration import (
    DuplicateRegistrationError,
    PassengerNotFoundError,
    UserNotFoundError,
    YatraNotActiveError,
    YatraNotFoundError,
    create_registration,
    get_registration_by_passenger_and_yatra,
    get_registrations_by_passenger,
    get_registrations_by_user,
    get_registrations_by_yatra,
    update_registration_packages,
    mark_registrations_as_cash,
)
from app.dependencies.db import get_db
from app.schemas.registration import (
    RegistrationCreate,
    RegistrationPackageUpdate,
    RegistrationResponse,
    RegistrationCashRequest,
    BookingResponse,
)

router = APIRouter(prefix="/registrations", tags=["Registrations"])


@router.post(
    "/",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a passenger for a Yatra",
)
async def register_passenger_for_yatra(
    payload: RegistrationCreate,
    db: AsyncSession = Depends(get_db),
) -> RegistrationResponse:
    try:
        registration = await create_registration(db, payload)
        return registration
    except PassengerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message) from exc
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message) from exc
    except YatraNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message) from exc
    except YatraNotActiveError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    except DuplicateRegistrationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.patch(
    "/{registration_id}/packages",
    response_model=RegistrationResponse,
    summary="Update hotel/travel packages on an existing registration",
)
async def patch_registration_packages(
    registration_id: int,
    payload: RegistrationPackageUpdate,
    db: AsyncSession = Depends(get_db),
) -> RegistrationResponse:
    reg = await update_registration_packages(db, registration_id, payload)
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registration {registration_id} not found.",
        )
    return reg


@router.get(
    "/lookup",
    response_model=RegistrationResponse | None,
    summary="Look up a registration by passenger + yatra",
)
async def lookup_registration(
    passenger_id: int,
    yatra_id: int,
    db: AsyncSession = Depends(get_db),
) -> RegistrationResponse | None:
    return await get_registration_by_passenger_and_yatra(db, passenger_id, yatra_id)


@router.get(
    "/yatra/{yatra_id}",
    response_model=list[RegistrationResponse],
    summary="List all registrations for a specific Yatra",
)
async def list_registrations_by_yatra(
    yatra_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[RegistrationResponse]:
    return await get_registrations_by_yatra(db, yatra_id)


@router.get(
    "/user/{user_id}/bookings",
    response_model=list[BookingResponse],
    summary="List all bookings with full joined passenger/yatra details for a user",
)
async def list_user_bookings(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[BookingResponse]:
    from app.crud.registration import get_user_bookings
    return await get_user_bookings(db, user_id)


@router.get(
    "/user/{user_id}",
    response_model=list[RegistrationResponse],
    summary="List all Yatra registrations for a specific user",
)
async def list_registrations_by_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[RegistrationResponse]:
    return await get_registrations_by_user(db, user_id)


@router.get(
    "/passenger/{passenger_id}",
    response_model=list[RegistrationResponse],
    summary="List all Yatra registrations for a specific passenger",
)
async def list_registrations_by_passenger(
    passenger_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[RegistrationResponse]:
    return await get_registrations_by_passenger(db, passenger_id)


@router.post(
    "/mark-cash",
    response_model=dict,
    summary="Mark multiple registrations for cash payment",
)
async def mark_cash_payment(
    payload: RegistrationCashRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not payload.registration_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No registrations selected.",
        )

    updated_ids = await mark_registrations_as_cash(db, payload.registration_ids)
    return {"message": f"Successfully marked {len(updated_ids)} registrations for cash payment."}
