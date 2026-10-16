from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.core.security import random_code, random_nonce
from app.core.timeutil import today_local, utcnow
from app.models import BusPass, PassApplication, PassType, User
from app.services import payments as payment_service

RENEW_WINDOW_DAYS = 7


def pass_effective_status(p: BusPass) -> str:
    today = today_local()
    if p.status == "revoked":
        return "revoked"
    if p.valid_to < today:
        return "expired"
    if p.valid_from > today:
        return "upcoming"
    return "active"


def apply_for_pass(db: Session, user: User, pass_type_id: int, declaration: str | None) -> PassApplication:
    pt = db.get(PassType, pass_type_id)
    if pt is None or not pt.is_active:
        raise NotFoundError("Pass type not found")
    if pt.eligibility != "general" and not (declaration and declaration.strip()):
        raise UnprocessableError(
            f"A declaration is required for {pt.eligibility} passes (e.g. institution or ID details). "
            "An administrator will verify it."
        )
    pending = db.scalar(
        select(PassApplication.id).where(
            PassApplication.user_id == user.id,
            PassApplication.pass_type_id == pt.id,
            PassApplication.status == "pending",
        )
    )
    if pending is not None:
        raise ConflictError("You already have a pending application for this pass type")
    today = today_local()
    live = db.scalar(
        select(BusPass.id).where(
            BusPass.user_id == user.id,
            BusPass.pass_type_id == pt.id,
            BusPass.status == "active",
            BusPass.valid_to >= today,
        )
    )
    if live is not None:
        raise ConflictError("You already hold this pass type. Use renewal when it is close to expiry.")

    app = PassApplication(
        user_id=user.id,
        pass_type_id=pt.id,
        price=pt.price,  # server-side price snapshot
        declaration=(declaration or "").strip() or None,
    )
    db.add(app)
    payment_service.create_pending_payment(db, user, pt.price, application=app)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ConflictError("You already have a pending application for this pass type")
    return app


def renew_pass(db: Session, user: User, pass_id: int) -> PassApplication:
    old = db.get(BusPass, pass_id)
    if old is None or old.user_id != user.id:
        raise NotFoundError("Pass not found")
    if old.status != "active":
        raise ConflictError("This pass was revoked and cannot be renewed")
    pt = old.pass_type
    if not pt.is_active:
        raise ConflictError("This pass type is no longer offered")
    today = today_local()
    days_left = (old.valid_to - today).days
    if days_left > RENEW_WINDOW_DAYS:
        raise ConflictError(f"Renewal opens {RENEW_WINDOW_DAYS} days before expiry")
    newer = db.scalar(
        select(BusPass.id).where(
            BusPass.user_id == user.id,
            BusPass.pass_type_id == old.pass_type_id,
            BusPass.status == "active",
            BusPass.valid_to > old.valid_to,
        )
    )
    if newer is not None:
        raise ConflictError("This pass has already been renewed")
    pending = db.scalar(
        select(PassApplication.id).where(
            PassApplication.user_id == user.id,
            PassApplication.pass_type_id == old.pass_type_id,
            PassApplication.status == "pending",
        )
    )
    if pending is not None:
        raise ConflictError("A renewal or application is already pending for this pass type")
    app = PassApplication(
        user_id=user.id,
        pass_type_id=pt.id,
        price=pt.price,
        is_renewal=True,
        renews_pass_id=old.id,
    )
    db.add(app)
    payment_service.create_pending_payment(db, user, pt.price, application=app)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ConflictError("A renewal is already pending")
    return app


def approve_application(db: Session, app: PassApplication, reviewer: User | None, note: str | None = None) -> BusPass:
    if app.status != "pending":
        raise ConflictError("Application is not pending")
    if app.payment is None or app.payment.status != "succeeded":
        raise ConflictError("Payment has not been verified for this application")
    pt = app.pass_type
    today = today_local()
    start: date = today
    renewed_from = None
    if app.is_renewal and app.renews_pass is not None:
        renewed_from = app.renews_pass.id
        start = max(today, app.renews_pass.valid_to + timedelta(days=1))
    bus_pass = BusPass(
        pass_code=random_code("TFP-", 10),
        user_id=app.user_id,
        pass_type_id=pt.id,
        valid_from=start,
        valid_to=start + timedelta(days=pt.duration_days - 1),
        qr_nonce=random_nonce(),
        renewed_from_id=renewed_from,
    )
    db.add(bus_pass)
    db.flush()
    app.status = "approved"
    app.pass_id = bus_pass.id
    app.reviewed_by = reviewer.id if reviewer else None
    app.reviewed_at = utcnow()
    app.review_note = note
    return bus_pass


def reject_application(db: Session, app: PassApplication, reviewer: User, note: str | None) -> None:
    if app.status != "pending":
        raise ConflictError("Application is not pending")
    app.status = "rejected"
    app.reviewed_by = reviewer.id
    app.reviewed_at = utcnow()
    app.review_note = note
    if app.payment is not None:
        if app.payment.status == "succeeded":
            payment_service.refund_payment(db, app.payment, app.payment.amount)
        else:
            payment_service.cancel_pending_payment(app.payment)
