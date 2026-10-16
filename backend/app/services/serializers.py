from app.core.config import get_settings
from app.core.security import make_qr_token
from app.core.timeutil import today_local
from app.models import Booking, BusPass, PassApplication, Payment
from app.services import bookings as booking_service
from app.services import passes as pass_service


def payment_out(p: Payment | None) -> dict | None:
    if p is None:
        return None
    return {
        "id": p.id,
        "reference": p.reference,
        "amount": p.amount,
        "currency": p.currency,
        "status": p.status,
        "provider": p.provider,
        "transaction_ref": p.provider_ref if p.status != "pending" or p.attempts else None,
        "refunded_amount": p.refunded_amount,
        "failure_reason": p.failure_reason,
        "created_at": p.created_at,
        "paid_at": p.paid_at,
    }


def booking_out(b: Booking, *, detail: bool = False, admin: bool = False) -> dict:
    out = {
        "id": b.id,
        "reference": b.reference,
        "status": b.status,
        "route_id": b.route_id,
        "route_code": b.route.code,
        "route_name": b.route.name,
        "from_stop_id": b.from_stop_id,
        "from_stop_name": b.from_stop.name,
        "to_stop_id": b.to_stop_id,
        "to_stop_name": b.to_stop.name,
        "travel_date": b.travel_date,
        "departure_time": b.departure_time,
        "passengers": b.passengers,
        "unit_fare": b.unit_fare,
        "total_fare": b.total_fare,
        "hold_expires_at": b.hold_expires_at,
        "cancelled_at": b.cancelled_at,
        "cancel_reason": b.cancel_reason,
        "refund_amount": b.refund_amount,
        "created_at": b.created_at,
        "payment": payment_out(b.payment),
        "qr_token": None,
        "cancellation": None,
        "passenger_name": b.user.full_name if admin else None,
        "passenger_email": b.user.email if admin else None,
    }
    if detail and b.status == "confirmed":
        out["qr_token"] = make_qr_token("B", b.reference, b.qr_nonce, get_settings().qr_signing_key)
    if detail and b.status in ("confirmed", "pending_payment"):
        out["cancellation"] = booking_service.cancellation_preview(b)
    return out


def pass_out(p: BusPass, *, with_qr: bool = True) -> dict:
    status = pass_service.pass_effective_status(p)
    days_left = (p.valid_to - today_local()).days
    can_renew = status in ("active", "expired") and days_left <= pass_service.RENEW_WINDOW_DAYS
    return {
        "id": p.id,
        "pass_code": p.pass_code,
        "pass_type_id": p.pass_type_id,
        "pass_type_name": p.pass_type.name,
        "eligibility": p.pass_type.eligibility,
        "status": status,
        "valid_from": p.valid_from,
        "valid_to": p.valid_to,
        "days_left": days_left,
        "can_renew": can_renew,
        "qr_token": make_qr_token("P", p.pass_code, p.qr_nonce, get_settings().qr_signing_key)
        if with_qr and status in ("active", "upcoming")
        else None,
        "created_at": p.created_at,
    }


def application_out(a: PassApplication, *, admin: bool = False) -> dict:
    status = a.status
    if a.status == "approved" and a.issued_pass is not None:
        status = pass_service.pass_effective_status(a.issued_pass)
    return {
        "id": a.id,
        "pass_type_id": a.pass_type_id,
        "pass_type_name": a.pass_type.name,
        "status": status,
        "raw_status": a.status,
        "price": a.price,
        "is_renewal": a.is_renewal,
        "declaration": a.declaration,
        "review_note": a.review_note,
        "created_at": a.created_at,
        "reviewed_at": a.reviewed_at,
        "pass_id": a.pass_id,
        "payment": payment_out(a.payment),
        "passenger_name": a.user.full_name if admin else None,
        "passenger_email": a.user.email if admin else None,
    }


def route_out(route, segment: dict | None = None) -> dict:
    stops = [
        {
            "stop_id": rs.stop_id,
            "stop_name": rs.stop.name,
            "city": rs.stop.city,
            "sequence": rs.sequence,
            "distance_km": rs.distance_km,
        }
        for rs in route.route_stops
    ]
    fare = route.fare_rule
    return {
        "id": route.id,
        "code": route.code,
        "name": route.name,
        "is_active": route.is_active,
        "operating_start": route.operating_start,
        "operating_end": route.operating_end,
        "frequency_minutes": route.frequency_minutes,
        "total_distance_km": stops[-1]["distance_km"] if stops else 0,
        "stops": stops,
        "fare": None
        if fare is None
        else {"base_fare": fare.base_fare, "per_km_rate": fare.per_km_rate, "min_fare": fare.min_fare},
        "segment": segment,
    }
