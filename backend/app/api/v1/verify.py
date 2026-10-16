from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import client_ip, verify_limiter
from app.core.security import parse_qr_token
from app.core.timeutil import today_local
from app.models import Booking, BusPass
from app.schemas.schemas import VerifyIn, VerifyOut
from app.services import passes as pass_service

router = APIRouter(tags=["verify"])

INVALID = {"valid": False, "reason": "Invalid or unrecognised code"}


@router.post("/verify", response_model=VerifyOut)
def verify(body: VerifyIn, request: Request, db: Session = Depends(get_db)):
    """Public QR verification. Returns no personal data. The QR signature only
    proves origin; validity is decided from the database every time."""
    verify_limiter.check(client_ip(request))
    parsed = parse_qr_token(body.token, get_settings().qr_signing_key)
    if parsed is None:
        return INVALID
    kind, code, nonce = parsed
    today = today_local()

    if kind == "B":
        b = db.scalar(select(Booking).where(Booking.reference == code))
        if b is None or b.qr_nonce != nonce:
            return INVALID
        summary = {
            "route": f"{b.route.code} {b.route.name}",
            "from": b.from_stop.name,
            "to": b.to_stop.name,
            "travel_date": b.travel_date.isoformat(),
            "departure_time": b.departure_time.strftime("%H:%M"),
            "passengers": b.passengers,
        }
        if b.status != "confirmed":
            return {"valid": False, "kind": "booking", "status": b.status, "code": code, "reason": f"Ticket is {b.status.replace('_', ' ')}", "summary": summary}
        if b.travel_date != today:
            when = "future" if b.travel_date > today else "past"
            return {"valid": False, "kind": "booking", "status": b.status, "code": code, "reason": f"Ticket is for a {when} date", "summary": summary}
        return {"valid": True, "kind": "booking", "status": "confirmed", "code": code, "summary": summary}

    p = db.scalar(select(BusPass).where(BusPass.pass_code == code))
    if p is None or p.qr_nonce != nonce:
        return INVALID
    status = pass_service.pass_effective_status(p)
    summary = {"pass_type": p.pass_type.name, "valid_from": p.valid_from.isoformat(), "valid_to": p.valid_to.isoformat()}
    if status != "active":
        return {"valid": False, "kind": "pass", "status": status, "code": code, "reason": f"Pass is {status}", "summary": summary}
    return {"valid": True, "kind": "pass", "status": "active", "code": code, "summary": summary}
