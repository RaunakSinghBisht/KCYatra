from sqlalchemy.ext.asyncio import AsyncSession

from app.models.yatra import Yatra
from app.schemas.yatra import YatraCreate


async def create_yatra(db: AsyncSession, data: YatraCreate, image_url: str | None) -> Yatra:
    yatra = Yatra(
        **data.model_dump(),
        image_url=image_url,
    )
    db.add(yatra)
    await db.commit()
    await db.refresh(yatra)
    return yatra
