from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.timeutil import today_local
from app.models import Booking, BusPass, PassApplication, Payment, User
from app.schemas.schemas import DashboardOut
from app.services import bookings as booking_service
from app.services import passes as pass_service
from app.services.serializers import booking_out, pass_out

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking_service.expire_stale_holds(db, user.id)
    db.commit()
    today = today_local()

    passes = db.scalars(select(BusPass).where(BusPass.user_id == user.id, BusPass.status == "active")).all()
    current = [p for p in passes if p.valid_from <= today <= p.valid_to]
    current.sort(key=lambda p: p.valid_to, reverse=True)
    active_pass = pass_out(current[0]) if current else None

    reminders: list[str] = []
    for p in current:
        left = (p.valid_to - today).days
        renewed = any(q.pass_type_id == p.pass_type_id and q.valid_to > p.valid_to for q in passes)
        if left <= pass_service.RENEW_WINDOW_DAYS and not renewed:
            when = "today" if left == 0 else f"in {left} day{'s' if left != 1 else ''}"
            reminders.append(f"Your {p.pass_type.name} expires {when}. Renew to avoid a gap.")
    pending_apps = db.scalar(
        select(func.count()).select_from(PassApplication).where(PassApplication.user_id == user.id, PassApplication.status == "pending")
    )
    unpaid = db.scalar(
        select(func.count()).select_from(Booking).where(Booking.user_id == user.id, Booking.status == "pending_payment")
    )
    if unpaid:
        reminders.append(f"You have {unpaid} booking{'s' if unpaid != 1 else ''} awaiting payment.")

    upcoming = db.scalars(
        select(Booking)
        .where(Booking.user_id == user.id, Booking.status == "confirmed", Booking.travel_date >= today)
        .order_by(Booking.travel_date, Booking.departure_time)
        .limit(5)
    ).all()
    recent = db.scalars(
        select(Booking).where(Booking.user_id == user.id).order_by(Booking.created_at.desc(), Booking.id.desc()).limit(5)
    ).all()

    confirmed_total = db.scalar(
        select(func.count()).select_from(Booking).where(Booking.user_id == user.id, Booking.status == "confirmed")
    )
    paid = db.scalar(select(func.coalesce(func.sum(Payment.amount - Payment.refunded_amount), 0)).where(
        Payment.user_id == user.id, Payment.status.in_(("succeeded", "partially_refunded", "refunded"))
    ))
    return {
        "active_pass": active_pass,
        "reminders": reminders,
        "upcoming_journeys": [booking_out(b, detail=True) for b in upcoming],
        "recent_bookings": [booking_out(b) for b in recent],
        "stats": {
            "confirmed_trips": confirmed_total or 0,
            "upcoming_trips": len(upcoming),
            "pending_applications": pending_apps or 0,
            "net_spent": str(Decimal(paid or 0).quantize(Decimal("0.01"))),
        },
    }
