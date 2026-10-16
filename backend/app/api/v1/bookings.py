from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.errors import NotFoundError
from app.core.rate_limit import client_ip, payment_limiter, write_limiter
from app.models import Booking, Payment, User
from app.schemas.schemas import BookingCreateIn, BookingOut, CancelIn, PayIn, PaymentOut
from app.services import bookings as booking_service
from app.services import payments as payment_service
from app.services.audit import log_action
from app.services.serializers import booking_out, payment_out

router = APIRouter(tags=["bookings"])


def _own_booking(db: Session, user: User, booking_id: int) -> Booking:
    b = db.scalar(select(Booking).where(Booking.id == booking_id, Booking.user_id == user.id))
    if b is None:
        raise NotFoundError("Booking not found")
    return b


@router.post("/bookings", response_model=BookingOut, status_code=201)
def create_booking(
    body: BookingCreateIn, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    write_limiter.check(f"u:{user.id}")
    b = booking_service.create_booking(db, user, **body.model_dump())
    log_action(db, user, "booking.create", "booking", b.id, {"reference": b.reference}, client_ip(request))
    db.commit()
    return booking_out(b, detail=True)


@router.get("/bookings", response_model=list[BookingOut])
def my_bookings(
    status: str | None = Query(default=None, pattern="^(pending_payment|confirmed|cancelled|expired)$"),
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking_service.expire_stale_holds(db, user.id)
    db.commit()
    stmt = select(Booking).where(Booking.user_id == user.id).order_by(Booking.created_at.desc(), Booking.id.desc()).limit(limit)
    if status:
        stmt = stmt.where(Booking.status == status)
    return [booking_out(b) for b in db.scalars(stmt).all()]


@router.get("/bookings/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking_service.expire_stale_holds(db, user.id)
    db.commit()
    return booking_out(_own_booking(db, user, booking_id), detail=True)


@router.post("/bookings/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int,
    request: Request,
    body: CancelIn | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = _own_booking(db, user, booking_id)
    booking_service.cancel_booking(db, b, by_admin=False, reason=body.reason if body else None)
    log_action(db, user, "booking.cancel", "booking", b.id, {"refund": str(b.refund_amount)}, client_ip(request))
    db.commit()
    return booking_out(b, detail=True)


@router.post("/payments/{payment_id}/pay", response_model=PaymentOut)
def pay(
    payment_id: int,
    request: Request,
    body: PayIn | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payment_limiter.check(f"u:{user.id}")
    payment = payment_service.pay(db, payment_id=payment_id, user=user, simulate=body.simulate if body else None)
    log_action(db, user, "payment.succeeded", "payment", payment.id, {"reference": payment.reference}, client_ip(request))
    db.commit()
    return payment_out(payment)


@router.get("/payments", response_model=list[PaymentOut])
def my_payments(limit: int = Query(default=50, ge=1, le=100), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc(), Payment.id.desc()).limit(limit)
    ).all()
    return [payment_out(p) for p in rows]
