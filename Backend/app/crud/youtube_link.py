from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.youtube_link import YouTubeLink


async def get_youtube_links(db: AsyncSession) -> list[YouTubeLink]:
    result = await db.execute(select(YouTubeLink).order_by(YouTubeLink.position))
    return list(result.scalars().all())


async def replace_youtube_links(db: AsyncSession, urls: list[str]) -> list[YouTubeLink]:
    """Delete all existing links and insert the new ordered list."""
    await db.execute(delete(YouTubeLink))
    links = [YouTubeLink(url=url, position=i) for i, url in enumerate(urls)]
    db.add_all(links)
    await db.commit()
    for link in links:
        await db.refresh(link)
    return links
