from fastapi import FastAPI

from app.routers import traveler as traveler_router

app = FastAPI(
    title="KCYatra API",
    version="1.0.0",
    description="Backend API for KCYatra",
)

# ── Routers ──────────────────────────────────────────────
app.include_router(traveler_router.router)

# TODO: Register yatra and registration routers here when ready
