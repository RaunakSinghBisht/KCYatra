from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dam_page import DamPage
from app.schemas.dam_page import DamPageUpdate

_DEFAULT_TITLE = "Website Under Maintenance"
_DEFAULT_DESC = (
    "We are performing scheduled maintenance to serve you better. "
    "Please check back in a little while. Hare Krishna!"
)


async def get_dam_page(db: AsyncSession) -> DamPage:
    """Return the singleton row, creating it with defaults if it doesn't exist."""
    row = await db.scalar(select(DamPage).where(DamPage.id == 1))
    if not row:
        row = DamPage(id=1, enabled=False, title=_DEFAULT_TITLE, description=_DEFAULT_DESC)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def update_dam_page(db: AsyncSession, data: DamPageUpdate) -> DamPage:
    row = await get_dam_page(db)
    if data.enabled is not None:
        row.enabled = data.enabled
    if data.title is not None:
        row.title = data.title
    if data.description is not None:
        row.description = data.description
    if data.otp_enabled is not None:
        row.otp_enabled = data.otp_enabled
    if data.accept_payments is not None:
        row.accept_payments = data.accept_payments
    await db.commit()
    await db.refresh(row)
    return row
