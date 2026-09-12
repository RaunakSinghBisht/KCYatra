import json
import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.yatra import create_yatra
from app.dependencies.db import get_db
from app.schemas.yatra import YatraCreate, YatraResponse

router = APIRouter(prefix="/yatras", tags=["Yatras"])

UPLOAD_DIR = "uploads/yatras"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post(
    "/",
    response_model=YatraResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Yatra listing",
)
async def create_yatra_route(
    # ── Required fields ──────────────────────────────────────
    title: str = Form(...),
    start_date: date = Form(...),
    end_date: date = Form(...),
    # ── Optional fields ───────────────────────────────────────
    is_start_date_fixed: bool = Form(True),
    is_end_date_fixed: bool = Form(True),
    hotel_packages: str | None = Form(None),      # JSON string: [{title, price}, ...]
    travel_packages: str | None = Form(None),     # JSON string: [{title, price}, ...]
    message_for_passengers: str | None = Form(None),
    whatsapp_group_link: str | None = Form(None),
    total_seats: int | None = Form(None),
    seats_available: int | None = Form(None),
    image: UploadFile | None = File(None),
    # ── Dependencies ─────────────────────────────────────────
    db: AsyncSession = Depends(get_db),
) -> YatraResponse:

    # Validate end_date >= start_date
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date.",
        )

    # Parse JSON strings for package lists
    try:
        parsed_hotel = json.loads(hotel_packages) if hotel_packages else None
        parsed_travel = json.loads(travel_packages) if travel_packages else None
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="hotel_packages and travel_packages must be valid JSON arrays.",
        )

    # Save uploaded image if provided
    image_url: str | None = None
    if image and image.filename:
        ext = os.path.splitext(image.filename)[-1]
        filename = f"{uuid.uuid4().hex}{ext}"
        save_path = os.path.join(UPLOAD_DIR, filename)
        content = await image.read()
        with open(save_path, "wb") as f:
            f.write(content)
        image_url = save_path

    # Build the schema object (reuses validation)
    yatra_data = YatraCreate(
        title=title,
        start_date=start_date,
        is_start_date_fixed=is_start_date_fixed,
        end_date=end_date,
        is_end_date_fixed=is_end_date_fixed,
        hotel_packages=parsed_hotel,
        travel_packages=parsed_travel,
        message_for_passengers=message_for_passengers,
        whatsapp_group_link=whatsapp_group_link,
        total_seats=total_seats,
        seats_available=seats_available,
    )

    try:
        yatra = await create_yatra(db, yatra_data, image_url)
        return yatra
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        ) from exc
