"""
In-memory sliding-window rate limiting.

State lives in this process, which matches how the OTP store works: run the backend with a single
worker. With several workers, move this (and the OTP store) to Redis.

    wait = limiter.wait_seconds("otp:send:phone:9876543210", limit=5, window=3600)
    if wait: raise too_many_requests(wait, "...")
    limiter.hit("otp:send:phone:9876543210")
"""

import math
import time
from collections import deque

from fastapi import HTTPException, Request, status

from app.core.config import settings

_KEEP_SECONDS = 3600  # entries older than the longest window we use are discarded
_SWEEP_EVERY = 600


class Limits:
    """The limits, fixed in code. (Many people on one Wi-Fi share an IP, so keep the per-IP numbers roomy.)"""

    otp_resend_cooldown_seconds = 30      # minimum gap between OTPs to the same phone
    otp_send_max_per_phone_per_hour = 5
    otp_send_max_per_ip_per_hour = 20
    otp_max_wrong_attempts_per_code = 3   # a code is cancelled after this many wrong tries
    otp_verify_window_seconds = 10 * 60   # wrong / expired codes are counted over this window
    otp_verify_max_failures_per_phone = 5
    otp_verify_max_failures_per_ip = 30
    admin_login_window_seconds = 15 * 60
    admin_login_max_failures_per_ip = 5


LIMITS = Limits()


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._last_sweep = time.monotonic()

    def wait_seconds(self, key: str, limit: int, window: int) -> int:
        """Seconds until `key` may act again; 0 if it has made fewer than `limit` hits in `window` seconds."""
        queue = self._hits.get(key)
        if not queue:
            return 0
        now = time.monotonic()
        cutoff = now - window
        while queue and queue[0] <= cutoff:
            queue.popleft()
        if len(queue) < limit:
            return 0
        # The hit that has to expire before there is room again.
        return max(1, math.ceil(queue[-limit] + window - now))

    def hit(self, key: str) -> None:
        now = time.monotonic()
        self._hits.setdefault(key, deque()).append(now)
        if now - self._last_sweep > _SWEEP_EVERY:
            self._sweep(now)

    def clear(self, key: str) -> None:
        self._hits.pop(key, None)

    def clear_all(self) -> None:
        self._hits.clear()

    def _sweep(self, now: float) -> None:
        self._last_sweep = now
        cutoff = now - _KEEP_SECONDS
        for key in [k for k, q in self._hits.items() if not q or q[-1] <= cutoff]:
            del self._hits[key]


limiter = RateLimiter()


def human_wait(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds} second{'s' if seconds != 1 else ''}"
    minutes = math.ceil(seconds / 60)
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


def too_many_requests(wait: int, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=message,
        headers={"Retry-After": str(wait)},
    )


def client_ip(request: Request) -> str:
    """
    The caller's IP. In production the backend only listens on localhost behind Nginx, which sets
    these headers itself, so they can be trusted. Otherwise use the socket address, which can't be spoofed.
    """
    if settings.ENV == "production":
        real = request.headers.get("x-real-ip", "").strip()
        if real:
            return real
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[-1].strip()  # the last entry is the one Nginx appended
    return request.client.host if request.client else "unknown"
