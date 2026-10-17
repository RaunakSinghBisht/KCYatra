from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.carousel import CarouselImage


async def create_carousel_image(db: AsyncSession, filename: str, position: int) -> CarouselImage:
    img = CarouselImage(filename=filename, position=position)
    db.add(img)
    await db.commit()
    await db.refresh(img)
    return img


async def get_all_carousel_images(db: AsyncSession) -> list[CarouselImage]:
    result = await db.execute(select(CarouselImage).order_by(CarouselImage.position))
    return list(result.scalars().all())


async def get_carousel_image_by_id(db: AsyncSession, image_id: int) -> CarouselImage | None:
    return await db.scalar(select(CarouselImage).where(CarouselImage.id == image_id))


async def delete_carousel_image(db: AsyncSession, image_id: int) -> str | None:
    img = await get_carousel_image_by_id(db, image_id)
    if not img:
        return None
    filename = img.filename
    await db.delete(img)
    await db.commit()
    return filename


async def reorder_carousel_images(db: AsyncSession, ids: list[int]) -> list[CarouselImage]:
    images = []
    for position, img_id in enumerate(ids):
        img = await get_carousel_image_by_id(db, img_id)
        if img:
            img.position = position
            images.append(img)
    await db.commit()
    for img in images:
        await db.refresh(img)
    return sorted(images, key=lambda x: x.position)
