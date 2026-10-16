from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ConflictError, UnprocessableError
from app.core.security import random_code, random_nonce
from app.core.timeutil import now_local, utcnow
from app.models import ACTIVE_BOOKING_STATUSES, Booking, Route, User
from app.services import payments as payment_service
from app.services import pricing

MAX_ADVANCE_DAYS = 30
MIN_LEAD_MINUTES = 10

# Documented cancellation policy
FULL_REFUND_HOURS = 24
HALF_REFUND_HOURS = 2


def _tz() -> ZoneInfo:
    return ZoneInfo(get_settings().operator_timezone)


def departure_dt(travel_date: date, departure_time: time) -> datetime:
    return datetime.combine(travel_date, departure_time.replace(tzinfo=None), tzinfo=_tz())


def departure_times(route: Route) -> list[time]:
    out: list[time] = []
    start = route.operating_start.hour * 60 + route.operating_start.minute
    end = route.operating_end.hour * 60 + route.operating_end.minute
    m = start
    while m <= end:
        out.append(time(m // 60, m % 60))
        m += route.frequency_minutes
    return out


def validate_departure(route: Route, travel_date: date, departure_time: time) -> datetime:
    t = departure_time.replace(second=0, microsecond=0, tzinfo=None)
    if t not in departure_times(route):
        raise UnprocessableError("Choose one of the scheduled departure times for this route")
    when = departure_dt(travel_date, t)
    now = now_local()
    if when < now + timedelta(minutes=MIN_LEAD_MINUTES):
        raise UnprocessableError("This departure is in the past or too close to booking")
    if travel_date > now.date() + timedelta(days=MAX_ADVANCE_DAYS):
        raise UnprocessableError(f"Bookings open at most {MAX_ADVANCE_DAYS} days ahead")
    return when


def expire_booking(db: Session, booking: Booking) -> None:
    booking.status = "expired"
    payment_service.cancel_pending_payment(booking.payment)


def expire_stale_holds(db: Session, user_id: int | None = None) -> int:
    q = select(Booking).where(Booking.status == "pending_payment", Booking.hold_expires_at < utcnow())
    if user_id is not None:
        q = q.where(Booking.user_id == user_id)
    stale = db.scalars(q).all()
    for b in stale:
        expire_booking(db, b)
    if stale:
        db.flush()
    return len(stale)


def create_booking(
    db: Session,
    user: User,
    *,
    route_id: int,
    from_stop_id: int,
    to_stop_id: int,
    travel_date: date,
    departure_time: time,
    passengers: int,
) -> Booking:
    expire_stale_holds(db, user.id)
    q = pricing.quote(db, route_id, from_stop_id, to_stop_id, passengers)
    t = departure_time.replace(second=0, microsecond=0, tzinfo=None)
    validate_departure(q.route, travel_date, t)

    clash = db.scalar(
        select(Booking).where(
            Booking.user_id == user.id,
            Booking.travel_date == travel_date,
            Booking.departure_time == t,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
        )
    )
    if clash is not None:
        raise ConflictError(
            f"You already have a booking at this date and time (reference {clash.reference}). "
            "Cancel it first or choose a different departure."
        )

    reference = random_code("TFB-", 10)
    while db.scalar(select(Booking.id).where(Booking.reference == reference)) is not None:
        reference = random_code("TFB-", 10)

    booking = Booking(
        reference=reference,
        user_id=user.id,
        route_id=route_id,
        from_stop_id=from_stop_id,
        to_stop_id=to_stop_id,
        travel_date=travel_date,
        departure_time=t,
        passengers=passengers,
        unit_fare=q.unit_fare,
        total_fare=q.total,
        status="pending_payment",
        qr_nonce=random_nonce(),
        hold_expires_at=utcnow() + timedelta(minutes=get_settings().booking_hold_minutes),
    )
    db.add(booking)
    payment_service.create_pending_payment(db, user, q.total, booking=booking)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ConflictError("A conflicting booking already exists for this date and time")
    return booking


def cancellation_preview(booking: Booking, *, by_admin: bool = False) -> dict:
    if booking.status in ("cancelled", "expired"):
        return {"allowed": False, "refund_percent": 0, "refund_amount": Decimal("0.00"), "message": "Already closed"}
    if booking.status == "pending_payment":
        return {"allowed": True, "refund_percent": 0, "refund_amount": Decimal("0.00"), "message": "Unpaid booking, nothing to refund"}
    hours = (departure_dt(booking.travel_date, booking.departure_time) - now_local()).total_seconds() / 3600
    if by_admin or hours >= FULL_REFUND_HOURS:
        pct = 100
    elif hours >= HALF_REFUND_HOURS:
        pct = 50
    else:
        return {
            "allowed": False,
            "refund_percent": 0,
            "refund_amount": Decimal("0.00"),
            "message": f"Cancellation is not allowed within {HALF_REFUND_HOURS} hours of departure",
        }
    amount = pricing.money(booking.total_fare * pct / 100)
    return {"allowed": True, "refund_percent": pct, "refund_amount": amount, "message": f"{pct}% refund"}


def cancel_booking(db: Session, booking: Booking, *, by_admin: bool, reason: str | None = None) -> Booking:
    if booking.status in ("cancelled", "expired"):
        raise ConflictError("This booking is already closed")
    prev = booking.status
    preview = cancellation_preview(booking, by_admin=by_admin)
    if not preview["allowed"]:
        raise ConflictError(preview["message"])
    if prev == "pending_payment":
        payment_service.cancel_pending_payment(booking.payment)
    elif booking.payment is not None:
        refunded = payment_service.refund_payment(db, booking.payment, preview["refund_amount"])
        booking.refund_amount = refunded
    booking.status = "cancelled"
    booking.cancelled_at = utcnow()
    booking.cancel_reason = (reason or ("Cancelled by administrator" if by_admin else "Cancelled by passenger"))[:200]
    db.flush()
    return booking
