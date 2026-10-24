from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.notice import (
    create_notice,
    delete_notice,
    get_all_notices,
    get_notice_by_id,
    update_notice,
)
from app.dependencies.auth import Principal, get_principal, require_admin
from app.dependencies.db import get_db
from app.schemas.notice import NoticeCreate, NoticeResponse, NoticeUpdate

router = APIRouter(prefix="/notices", tags=["Notices"])


@router.post(
    "/",
    response_model=NoticeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and publish a new notice",
    dependencies=[Depends(require_admin)],
)
async def create_notice_route(
    data: NoticeCreate,
    db: AsyncSession = Depends(get_db),
) -> NoticeResponse:
    try:
        return await create_notice(db, data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.get(
    "/",
    response_model=list[NoticeResponse],
    summary="List all notices (admin) or only published (traveller)",
)
async def list_notices(
    published_only: bool = Query(False, description="If true, return only published notices"),
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> list[NoticeResponse]:
    # Customers only ever see published notices; drafts are for the admin.
    return await get_all_notices(db, published_only=published_only or not principal.is_admin)


@router.get(
    "/{notice_id}",
    response_model=NoticeResponse,
    summary="Get a single notice by ID",
)
async def get_notice(
    notice_id: int,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> NoticeResponse:
    notice = await get_notice_by_id(db, notice_id)
    if not notice or (not notice.is_published and not principal.is_admin):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notice with id={notice_id} not found.",
        )
    return notice


@router.patch(
    "/{notice_id}",
    response_model=NoticeResponse,
    summary="Partially update a notice (title, body, tag, published status)",
    dependencies=[Depends(require_admin)],
)
async def patch_notice(
    notice_id: int,
    data: NoticeUpdate,
    db: AsyncSession = Depends(get_db),
) -> NoticeResponse:
    notice = await get_notice_by_id(db, notice_id)
    if not notice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notice with id={notice_id} not found.",
        )
    try:
        return await update_notice(db, notice, data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.put(
    "/{notice_id}",
    response_model=NoticeResponse,
    summary="Update a notice",
    dependencies=[Depends(require_admin)],
)
async def put_notice(
    notice_id: int,
    data: NoticeUpdate,
    db: AsyncSession = Depends(get_db),
) -> NoticeResponse:
    notice = await get_notice_by_id(db, notice_id)
    if not notice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notice with id={notice_id} not found.",
        )
    try:
        return await update_notice(db, notice, data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{notice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a notice permanently",
    dependencies=[Depends(require_admin)],
)
async def delete_notice_route(
    notice_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    notice = await get_notice_by_id(db, notice_id)
    if not notice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notice with id={notice_id} not found.",
        )
    await delete_notice(db, notice)
