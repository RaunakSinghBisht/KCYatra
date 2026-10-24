from functools import lru_cache

from pydantic_settings import BaseSettings

# Public placeholder — the app refuses to start in production while this is still in use.
DEFAULT_SECRET_KEY = "NAHY6Bf3FhOryYWCGqpMAdgWrUHIXbnPV5kpmmYKeZP"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/kcyatra_db"
    SECRET_KEY: str = DEFAULT_SECRET_KEY  # signs the JWTs
    ALGORITHM: str = "HS256"
    ENV: str = "development"
    DEBUG: bool = True

    # ── Authentication ────────────────────────────────────────────────────────
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 20
    # Refresh-token lifetime, counted from the last use (each refresh extends it).
    REFRESH_TOKEN_EXPIRE_DAYS_USER: int = 7
    REFRESH_TOKEN_EXPIRE_DAYS_ADMIN: int = 1
    # Seconds a just-rotated refresh token is still accepted (two tabs refreshing at once).
    REFRESH_REUSE_GRACE_SECONDS: int = 30
    # Refresh-cookie "Secure" flag. Unset = secure only when ENV=production.
    AUTH_COOKIE_SECURE: bool | None = None

    # Allowed browser origins, e.g. CORS_ORIGINS=["https://yourdomain.com"] in .env
    CORS_ORIGINS: list[str] = []

    # Admin panel login. Empty = admin login disabled (no default password).
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

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
    # Set in Razorpay Dashboard → Webhooks (separate from the API secret).
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # ── Yatra Image Storage ───────────────────────────────────────────────────
    YATRA_IMAGE_DIR: str = "../Frontend/public/yatras"
    YATRA_IMAGE_URL_PREFIX: str = "/yatras/"

    # ── Carousel Image Storage ────────────────────────────────────────────────
    CAROUSEL_IMAGE_DIR: str = "../Frontend/public/carousel"
    CAROUSEL_IMAGE_URL_PREFIX: str = "/carousel/"

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
