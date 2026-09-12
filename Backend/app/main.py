from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db.base import Base
from app.db.session import engine

# Import all models here so SQLAlchemy registers them with Base.metadata
from app.models.traveler import Traveler  # noqa: F401
from app.models.yatra import Yatra  # noqa: F401
from app.models.registration import Registration  # noqa: F401

from app.routers import traveler as traveler_router
from app.routers import yatra as yatra_router
from app.routers import registration as registration_router

 
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables that don't exist yet
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: dispose the connection pool cleanly
    await engine.dispose()


app = FastAPI(
    title="KCYatra API",
    version="1.0.0",
    description="Backend API for KCYatra",
    lifespan=lifespan,
)

# ── Routers ──────────────────────────────────────────────
app.include_router(traveler_router.router)
app.include_router(yatra_router.router)
app.include_router(registration_router.router)
