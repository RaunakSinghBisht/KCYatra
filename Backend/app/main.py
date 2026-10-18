from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.base import Base
from app.db.session import engine

# Import all models so SQLAlchemy registers them with Base.metadata
from app.models.user import User  # noqa: F401
from app.models.passenger import Passenger  # noqa: F401
from app.models.yatra import Yatra  # noqa: F401
from app.models.registration import Registration  # noqa: F401
from app.models.notice import Notice  # noqa: F401
from app.models.carousel import CarouselImage  # noqa: F401
from app.models.youtube_link import YouTubeLink  # noqa: F401
from app.models.dam_page import DamPage  # noqa: F401
from app.models.payment_order import PaymentOrder  # noqa: F401

from app.routers import user as user_router
from app.routers import passenger as passenger_router
from app.routers import yatra as yatra_router
from app.routers import registration as registration_router
from app.routers import otp as otp_router
from app.routers import payment as payment_router
from app.routers import notice as notice_router
from app.routers import carousel as carousel_router
from app.routers import youtube_link as youtube_link_router
from app.routers import dam_page as dam_page_router


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

# ── CORS ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────
app.include_router(user_router.router)
app.include_router(passenger_router.router)
app.include_router(yatra_router.router)
app.include_router(registration_router.router)
app.include_router(otp_router.router)
app.include_router(payment_router.router)
app.include_router(notice_router.router)
app.include_router(carousel_router.router)
app.include_router(youtube_link_router.router)
app.include_router(dam_page_router.router)
