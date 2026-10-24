from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.dam_page import get_dam_page, update_dam_page
from app.dependencies.auth import require_admin
from app.dependencies.db import get_db
from app.schemas.dam_page import DamPageResponse, DamPageUpdate

router = APIRouter(prefix="/dam-page", tags=["Dam Page"])


@router.get(
    "/",
    response_model=DamPageResponse,
    summary="Get current Dam Page settings",
)
async def get_dam_page_route(
    db: AsyncSession = Depends(get_db),
) -> DamPageResponse:
    return await get_dam_page(db)


@router.put(
    "/",
    response_model=DamPageResponse,
    summary="Update Dam Page settings (partial update)",
    dependencies=[Depends(require_admin)],
)
async def update_dam_page_route(
    payload: DamPageUpdate,
    db: AsyncSession = Depends(get_db),
) -> DamPageResponse:
    try:
        return await update_dam_page(db, payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
