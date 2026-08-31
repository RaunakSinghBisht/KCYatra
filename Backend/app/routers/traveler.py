from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.traveler import DuplicateTravelerError, create_traveler
from app.dependencies.db import get_db
from app.schemas.traveler import TravelerCreate, TravelerResponse

router = APIRouter(prefix="/travelers", tags=["Travelers"])


@router.post(
    "/",
    response_model=TravelerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new traveler",
)
async def register_traveler(
    payload: TravelerCreate,
    db: AsyncSession = Depends(get_db),
) -> TravelerResponse:
    try:
        traveler = await create_traveler(db, payload)
        return traveler
    except DuplicateTravelerError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        ) from exc
