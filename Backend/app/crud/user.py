from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate


class DuplicateUserError(Exception):
    """Raised when phone already exists in the DB."""
    def __init__(self, field: str) -> None:
        self.field = field
        super().__init__(f"User with this {field} already exists.")


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    existing_phone = await db.scalar(
        select(User).where(User.phone == data.phone)
    )
    if existing_phone:
        raise DuplicateUserError("phone")

    user = User(**data.model_dump())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    return await db.scalar(select(User).where(User.id == user_id))


async def get_user_by_phone(db: AsyncSession, phone: str) -> User | None:
    return await db.scalar(select(User).where(User.phone == phone))
