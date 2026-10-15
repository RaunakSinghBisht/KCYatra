from sqlalchemy import select
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


async def get_all_yatras(db: AsyncSession) -> list[Yatra]:
    result = await db.execute(select(Yatra).order_by(Yatra.start_date.desc()))
    return list(result.scalars().all())


async def get_yatra_by_id(db: AsyncSession, yatra_id: int) -> Yatra | None:
    return await db.scalar(select(Yatra).where(Yatra.id == yatra_id))
