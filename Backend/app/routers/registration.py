from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.registration import (
    DuplicateRegistrationError,
    TravelerNotFoundError,
    YatraNotActiveError,
    YatraNotFoundError,
    create_registration,
    get_registrations_by_traveler,
    get_registrations_by_yatra,
)
from app.dependencies.db import get_db
from app.schemas.registration import RegistrationCreate, RegistrationResponse

router = APIRouter(prefix="/registrations", tags=["Registrations"])


@router.post(
    "/",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a traveler for a Yatra",
)
async def register_traveler_for_yatra(
    payload: RegistrationCreate,
    db: AsyncSession = Depends(get_db),
) -> RegistrationResponse:
    try:
        registration = await create_registration(db, payload)
        return registration
    except TravelerNotFoundError as exc:
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
            detail="An unexpected error occurred.",
        ) from exc


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
    "/traveler/{traveler_id}",
    response_model=list[RegistrationResponse],
    summary="List all Yatra registrations for a specific traveler",
)
async def list_registrations_by_traveler(
    traveler_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[RegistrationResponse]:
    return await get_registrations_by_traveler(db, traveler_id)
