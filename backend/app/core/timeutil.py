from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(d: datetime) -> datetime:
    """DB drivers may return naive datetimes (SQLite). Treat them as UTC."""
    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)


def now_local() -> datetime:
    return datetime.now(ZoneInfo(get_settings().operator_timezone))


def today_local() -> date:
    return now_local().date()
