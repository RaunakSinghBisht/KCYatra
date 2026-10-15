from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/kcyatra_db"
    SECRET_KEY: str = "NAHY6Bf3FhOryYWCGqpMAdgWrUHIXbnPV5kpmmYKeZP"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ENV: str = "development"
    DEBUG: bool = True

    # ── Fast2SMS ──────────────────────────────────────────────────────────────
    FAST2SMS_API_KEY: str = ""
    FAST2SMS_SENDER_ID: str = "GMDTRX"
    FAST2SMS_OTP_TEMPLATE_ID: str = ""       # DLT template ID for OTP
    FAST2SMS_PAYMENT_TEMPLATE_ID: str = ""   # DLT template ID for payment confirm

    # OTP TTL in seconds (default: 5 minutes)
    OTP_TTL_SECONDS: int = 300

    # Set to True to accept hardcoded OTP "123456" without sending a real SMS.
    # Useful during development/testing. MUST be False in production.
    OTP_BYPASS_ENABLED: bool = False

    # ── Razorpay ──────────────────────────────────────────────────────────────
    RAZORPAY_API_KEY: str = ""
    RAZORPAY_API_SECRET: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance (re-reads .env on first call after restart)."""
    return Settings()


# Convenience alias used across the app — always points to the cached instance.
settings: Settings = get_settings()
