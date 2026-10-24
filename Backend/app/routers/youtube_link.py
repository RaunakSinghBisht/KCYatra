from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.youtube_link import get_youtube_links, replace_youtube_links
from app.dependencies.auth import require_admin
from app.dependencies.db import get_db
from app.schemas.youtube_link import YouTubeLinkResponse, YouTubeLinksUpdate

router = APIRouter(prefix="/youtube-links", tags=["YouTube Links"])


@router.get(
    "/",
    response_model=list[YouTubeLinkResponse],
    summary="List all YouTube links in display order",
)
async def list_youtube_links(
    db: AsyncSession = Depends(get_db),
) -> list[YouTubeLinkResponse]:
    return await get_youtube_links(db)


@router.put(
    "/",
    response_model=list[YouTubeLinkResponse],
    summary="Replace the full YouTube link list (max 3 valid URLs)",
    dependencies=[Depends(require_admin)],
)
async def update_youtube_links(
    payload: YouTubeLinksUpdate,
    db: AsyncSession = Depends(get_db),
) -> list[YouTubeLinkResponse]:
    try:
        return await replace_youtube_links(db, payload.urls)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
