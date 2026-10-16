from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.core.security import random_code
from app.core.timeutil import as_utc, utcnow
from app.models import Booking, PassApplication, Payment, User
from app.payments import get_provider
from app.services.pricing import money

MAX_ATTEMPTS = 5


class PaymentDeclined(ConflictError):
    status_code = 402


def create_pending_payment(
    db: Session, user: User, amount: Decimal, *, booking: Booking | None = None, application: PassApplication | None = None
) -> Payment:
    payment = Payment(
        reference=random_code("TFT-", 10),
        user_id=user.id,
        booking=booking,
        application=application,
        amount=amount,
        currency=get_settings().currency,
        provider=get_provider().name,
    )
    db.add(payment)
    return payment


def pay(db: Session, *, payment_id: int, user: User, simulate: str | None) -> Payment:
    """Charge a pending payment. Idempotent for already-succeeded payments.

    Success is decided ONLY by provider.verify(), never by client input.
    """
    from app.services import bookings as booking_service
    from app.services import passes as pass_service

    payment = db.execute(select(Payment).where(Payment.id == payment_id).with_for_update()).scalar_one_or_none()
    if payment is None or payment.user_id != user.id:
        raise NotFoundError("Payment not found")
    if payment.status == "succeeded":
        return payment
    if payment.status != "pending":
        raise ConflictError(f"This payment is {payment.status.replace('_', ' ')} and cannot be paid")

    booking, application = payment.booking, payment.application
    if booking is not None:
        if booking.status != "pending_payment":
            raise ConflictError("This booking is no longer awaiting payment")
        if booking.hold_expires_at is not None and as_utc(booking.hold_expires_at) < utcnow():
            booking_service.expire_booking(db, booking)
            db.commit()
            raise ConflictError("The booking hold expired. Please create the booking again.")
    if application is not None and application.status != "pending":
        raise ConflictError("This application is no longer pending")

    settings = get_settings()
    if simulate and settings.payment_provider != "simulated":
        raise UnprocessableError("Simulation options are only available with the simulated provider")

    provider = get_provider()
    payment.attempts += 1
    result = provider.charge(
        amount=payment.amount, currency=payment.currency, reference=payment.reference, simulate=simulate
    )
    payment.provider_ref = result.provider_ref
    verified = provider.verify(result.provider_ref)

    if verified == "succeeded":
        payment.status = "succeeded"
        payment.paid_at = utcnow()
        payment.failure_reason = None
        if booking is not None:
            booking.status = "confirmed"
            booking.hold_expires_at = None
        if application is not None and application.is_renewal:
            pass_service.approve_application(db, application, reviewer=None, note="Auto-approved renewal after payment")
        db.commit()
        return payment

    payment.failure_reason = "Payment was declined by the provider"
    if payment.attempts >= MAX_ATTEMPTS:
        payment.status = "failed"
        if booking is not None:
            booking_service.expire_booking(db, booking)
    db.commit()
    raise PaymentDeclined("Payment declined. You can try again.")


def refund_payment(db: Session, payment: Payment, amount: Decimal) -> Decimal:
    """Refund up to the remaining amount. Returns the amount actually refunded."""
    if payment.status not in ("succeeded", "partially_refunded") or payment.provider_ref is None:
        return Decimal("0.00")
    remaining = payment.amount - payment.refunded_amount
    amount = min(money(amount), remaining)
    if amount <= 0:
        return Decimal("0.00")
    payment.refund_ref = get_provider().refund(payment.provider_ref, amount)
    payment.refunded_amount = payment.refunded_amount + amount
    payment.status = "refunded" if payment.refunded_amount >= payment.amount else "partially_refunded"
    return amount


def cancel_pending_payment(payment: Payment | None) -> None:
    if payment is not None and payment.status == "pending":
        payment.status = "cancelled"
