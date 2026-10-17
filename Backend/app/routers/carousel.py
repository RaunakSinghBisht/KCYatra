from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud.carousel import (
    create_carousel_image,
    delete_carousel_image,
    get_all_carousel_images,
    reorder_carousel_images,
)
from app.dependencies.db import get_db
from app.schemas.carousel import CarouselImageResponse, CarouselReorderRequest

router = APIRouter(prefix="/carousel", tags=["Carousel"])

IMAGE_DIR = Path(settings.CAROUSEL_IMAGE_DIR).resolve()
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


def _datetime_filename(original: str) -> str:
    """Generate a unique filename using current datetime + microseconds."""
    ext = Path(original or "image.jpg").suffix.lower() or ".jpg"
    ts = datetime.now().strftime("%Y%m%d%H%M%S%f")[:17]  # YYYYMMDDHHMMSSMMM
    return f"{ts}{ext}"


def _delete_file(filename: str) -> None:
    target = IMAGE_DIR / filename
    try:
        if target.exists():
            target.unlink()
    except OSError:
        pass


@router.get(
    "/",
    response_model=list[CarouselImageResponse],
    summary="List carousel images in display order",
)
async def list_carousel_images(
    db: AsyncSession = Depends(get_db),
) -> list[CarouselImageResponse]:
    return await get_all_carousel_images(db)


@router.post(
    "/",
    response_model=list[CarouselImageResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload one or more carousel images",
)
async def upload_carousel_images(
    images: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
) -> list[CarouselImageResponse]:
    existing = await get_all_carousel_images(db)
    next_position = len(existing)

    created = []
    saved_files: list[str] = []

    try:
        for image in images:
            content_type = image.content_type or ""
            if content_type not in ALLOWED_CONTENT_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Only JPEG, PNG and WebP images are accepted. Got: {content_type}",
                )
            content = await image.read()
            if len(content) > MAX_IMAGE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Each image must be smaller than 10 MB.",
                )
            filename = _datetime_filename(image.filename or "image.jpg")
            (IMAGE_DIR / filename).write_bytes(content)
            saved_files.append(filename)

            img = await create_carousel_image(db, filename, next_position)
            created.append(img)
            next_position += 1

    except HTTPException:
        for fn in saved_files:
            _delete_file(fn)
        raise

    return created


@router.delete(
    "/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a carousel image",
)
async def delete_carousel_image_route(
    image_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    filename = await delete_carousel_image(db, image_id)
    if filename is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Carousel image {image_id} not found.",
        )
    _delete_file(filename)


@router.patch(
    "/reorder",
    response_model=list[CarouselImageResponse],
    summary="Reorder carousel images by providing IDs in the desired order",
)
async def reorder_carousel(
    payload: CarouselReorderRequest,
    db: AsyncSession = Depends(get_db),
) -> list[CarouselImageResponse]:
    if not payload.ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ids list must not be empty.",
        )
    return await reorder_carousel_images(db, payload.ids)
