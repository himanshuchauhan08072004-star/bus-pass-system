import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import AppError


class TooManyRequests(AppError):
    status_code = 429


def client_ip(request: Request) -> str:
    if get_settings().trust_forwarded_for:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """In-memory sliding window, PER APPLICATION INSTANCE.

    With multiple instances each keeps its own counters. For a shared limit
    move this to Redis (ElastiCache) or AWS WAF rate-based rules.
    """

    def __init__(self, name: str, limit: int | None, window_seconds: int = 60):
        self.name = name
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        settings = get_settings()
        if not settings.rate_limit_enabled:
            return
        limit = self.limit if self.limit is not None else settings.rate_limit_per_minute
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= limit:
                raise TooManyRequests("Too many requests. Please slow down and try again shortly.")
            q.append(now)


    def dependency(self):
        def _dep(request: Request) -> None:
            self.check(client_ip(request))

        return _dep


login_limiter = RateLimiter("login", 10)
register_limiter = RateLimiter("register", 5)
payment_limiter = RateLimiter("payment", 20)
verify_limiter = RateLimiter("verify", None)
write_limiter = RateLimiter("write", 60)

ALL_LIMITERS = [login_limiter, register_limiter, payment_limiter, verify_limiter, write_limiter]


def reset_all() -> None:
    for lim in ALL_LIMITERS:
        with lim._lock:
            lim._hits.clear()
