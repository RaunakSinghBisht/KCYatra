from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.yatra import Yatra
from app.schemas.yatra import YatraCreate, YatraUpdate


async def create_yatra(db: AsyncSession, data: YatraCreate, image_url: str | None) -> Yatra:
    yatra = Yatra(
        **data.model_dump(),
        image_url=image_url,
    )
    db.add(yatra)
    await db.commit()
    await db.refresh(yatra)
    return yatra


async def get_all_yatras(db: AsyncSession, include_drafts: bool = False) -> list[Yatra]:
    query = select(Yatra).where(Yatra.is_deleted == False)  # noqa: E712
    if not include_drafts:
        query = query.where(Yatra.status != "draft")
    result = await db.execute(query.order_by(Yatra.start_date.desc()))
    return list(result.scalars().all())


async def get_yatra_by_id(db: AsyncSession, yatra_id: int) -> Yatra | None:
    return await db.scalar(
        select(Yatra).where(Yatra.id == yatra_id, Yatra.is_deleted == False)  # noqa: E712
    )


async def update_yatra(db: AsyncSession, yatra: Yatra, data: YatraUpdate, image_url: str | None = None) -> Yatra:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:  # None = "don't change"; prevents writing NULL into NOT NULL columns
            setattr(yatra, field, value)
    if image_url is not None:
        yatra.image_url = image_url
    await db.commit()
    await db.refresh(yatra)
    return yatra


async def delete_yatra(db: AsyncSession, yatra: Yatra) -> None:
    yatra.is_deleted = True
    await db.commit()
