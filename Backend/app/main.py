from fastapi import FastAPI

app = FastAPI(
    title="KCYatra API",
    version="1.0.0",
    description="Backend API for KCYatra",
)

# TODO: Include routers here
# Example:
# from app.routers import some_router
# app.include_router(some_router.router, prefix="/api/v1")
