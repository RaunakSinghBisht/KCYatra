from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notice import Notice
from app.schemas.notice import NoticeCreate, NoticeUpdate


async def create_notice(db: AsyncSession, data: NoticeCreate) -> Notice:
    notice = Notice(**data.model_dump())
    db.add(notice)
    await db.commit()
    await db.refresh(notice)
    return notice


async def get_all_notices(db: AsyncSession, published_only: bool = False) -> list[Notice]:
    stmt = select(Notice).order_by(Notice.created_at.desc())
    if published_only:
        stmt = stmt.where(Notice.is_published.is_(True))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_notice_by_id(db: AsyncSession, notice_id: int) -> Notice | None:
    return await db.scalar(select(Notice).where(Notice.id == notice_id))


async def update_notice(db: AsyncSession, notice: Notice, data: NoticeUpdate) -> Notice:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(notice, field, value)
    await db.commit()
    await db.refresh(notice)
    return notice


async def delete_notice(db: AsyncSession, notice: Notice) -> None:
    await db.delete(notice)
    await db.commit()
