import json
import os
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud.yatra import create_yatra, delete_yatra, get_all_yatras, get_yatra_by_id, update_yatra
from app.dependencies.auth import Principal, get_principal, require_admin
from app.dependencies.db import get_db
from app.schemas.yatra import YatraCreate, YatraResponse, YatraUpdate

router = APIRouter(prefix="/yatras", tags=["Yatras"])

# ── Image storage helpers ──────────────────────────────────────────────────────
IMAGE_DIR = Path(settings.YATRA_IMAGE_DIR).resolve()
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def _delete_image_file(image_url: str | None) -> None:
    """Delete a previously saved image file (best-effort, never raises)."""
    if not image_url:
        return
    # image_url is stored as e.g. "/yatras/abc123.jpg"
    filename = Path(image_url).name
    target = IMAGE_DIR / filename
    try:
        if target.exists():
            target.unlink()
    except OSError:
        pass  # non-critical — log in production


async def _save_image(image: UploadFile) -> str:
    """Validate, save, and return the image_url to store in the DB."""
    content_type = image.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only JPEG, PNG, and WebP images are accepted.",
        )
    content = await image.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image must be smaller than 5 MB.",
        )
    ext = Path(image.filename or "image.jpg").suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    (IMAGE_DIR / filename).write_bytes(content)
    return f"{settings.YATRA_IMAGE_URL_PREFIX}{filename}"  # e.g. "/yatras/abc123.jpg"


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=YatraResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Yatra listing",
    dependencies=[Depends(require_admin)],
)
async def create_yatra_route(
    title: str = Form(...),
    start_date: date = Form(...),
    end_date: date = Form(...),
    is_start_date_fixed: bool = Form(True),
    is_end_date_fixed: bool = Form(True),
    hotel_packages: str | None = Form(None),
    travel_packages: str | None = Form(None),
    description: str | None = Form(None),
    whatsapp_group_link: str | None = Form(None),
    allow_whatsapp_before_payment: bool = Form(False),
    status_field: str = Form("upcoming", alias="status"),
    image: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
) -> YatraResponse:

    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date.",
        )

    try:
        parsed_hotel = json.loads(hotel_packages) if hotel_packages else None
        parsed_travel = json.loads(travel_packages) if travel_packages else None
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="hotel_packages and travel_packages must be valid JSON arrays.",
        )

    # Save image → get URL or None
    image_url: str | None = None
    if image and image.filename:
        image_url = await _save_image(image)

    yatra_data = YatraCreate(
        title=title,
        start_date=start_date,
        is_start_date_fixed=is_start_date_fixed,
        end_date=end_date,
        is_end_date_fixed=is_end_date_fixed,
        hotel_packages=parsed_hotel,
        travel_packages=parsed_travel,
        description=description,
        whatsapp_group_link=whatsapp_group_link,
        allow_whatsapp_before_payment=allow_whatsapp_before_payment,
        status=status_field.lower(),
    )

    try:
        yatra = await create_yatra(db, yatra_data, image_url)
        return yatra
    except Exception as exc:
        # Clean up the just-saved image if the DB write failed
        _delete_image_file(image_url)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.get(
    "/",
    response_model=list[YatraResponse],
    summary="List Yatras (drafts are visible to admins only)",
)
async def list_yatras(
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> list[YatraResponse]:
    return await get_all_yatras(db, include_drafts=principal.is_admin)


@router.get(
    "/{yatra_id}",
    response_model=YatraResponse,
    summary="Get a single Yatra by ID (drafts are visible to admins only)",
)
async def get_yatra(
    yatra_id: int,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> YatraResponse:
    yatra = await get_yatra_by_id(db, yatra_id)
    if not yatra or (yatra.status == "draft" and not principal.is_admin):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Yatra with id={yatra_id} not found.",
        )
    return yatra


@router.put(
    "/{yatra_id}",
    response_model=YatraResponse,
    summary="Update a Yatra (replaces image if provided, deletes old)",
    dependencies=[Depends(require_admin)],
)
async def update_yatra_route(
    yatra_id: int,
    title: str | None = Form(None),
    start_date: date | None = Form(None),
    end_date: date | None = Form(None),
    is_start_date_fixed: bool | None = Form(None),
    is_end_date_fixed: bool | None = Form(None),
    hotel_packages: str | None = Form(None),
    travel_packages: str | None = Form(None),
    description: str | None = Form(None),
    whatsapp_group_link: str | None = Form(None),
    allow_whatsapp_before_payment: bool | None = Form(None),
    status_field: str | None = Form(None, alias="status"),
    image: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
) -> YatraResponse:

    yatra = await get_yatra_by_id(db, yatra_id)
    if not yatra:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Yatra with id={yatra_id} not found.",
        )

    try:
        parsed_hotel = json.loads(hotel_packages) if hotel_packages else None
        parsed_travel = json.loads(travel_packages) if travel_packages else None
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="hotel_packages and travel_packages must be valid JSON arrays.",
        )

    # Save new image first — then delete old one only if save succeeds
    new_image_url: str | None = None
    if image and image.filename:
        old_image_url = yatra.image_url   # capture before overwrite
        new_image_url = await _save_image(image)
        _delete_image_file(old_image_url)   # remove the previous file

    update_data = YatraUpdate(
        title=title,
        start_date=start_date,
        end_date=end_date,
        is_start_date_fixed=is_start_date_fixed,
        is_end_date_fixed=is_end_date_fixed,
        hotel_packages=parsed_hotel,
        travel_packages=parsed_travel,
        description=description,
        whatsapp_group_link=whatsapp_group_link,
        allow_whatsapp_before_payment=allow_whatsapp_before_payment,
        status=status_field.lower() if status_field else None,
    )

    try:
        updated = await update_yatra(db, yatra, update_data, new_image_url)
        return updated
    except Exception as exc:
        # DB failed — rollback the new file to avoid orphan
        _delete_image_file(new_image_url)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{yatra_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a Yatra and its banner image",
    dependencies=[Depends(require_admin)],
)
async def delete_yatra_route(
    yatra_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    yatra = await get_yatra_by_id(db, yatra_id)
    if not yatra:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Yatra with id={yatra_id} not found.",
        )
    image_url = yatra.image_url   # capture before deletion
    await delete_yatra(db, yatra)
    _delete_image_file(image_url)   # clean up the file after successful DB delete
