from datetime import datetime, timedelta
from decimal import Decimal

from app.core.security import parse_qr_token
from app.core.config import get_settings
from app.models import Booking, Payment
from app.services import bookings as booking_service
from app.core.timeutil import utcnow
from tests.conftest import Api, booking_payload


def _book(pax, route, **kw):
    r = pax.post("/bookings", booking_payload(route, **kw))
    assert r.status_code == 201, r.text
    return r.json()


def _pay(pax, booking, simulate=None):
    return pax.post(f"/payments/{booking['payment']['id']}/pay", {"simulate": simulate} if simulate else None)


def test_booking_flow_with_server_side_price(pax, route101):
    payload = booking_payload(route101, passengers=2)
    payload.update({"unit_fare": "0.01", "total_fare": "0.01", "status": "confirmed", "amount": "1"})  # tampering attempt
    r = pax.post("/bookings", payload)
    assert r.status_code == 201
    b = r.json()
    assert Decimal(b["total_fare"]) == Decimal("156.80") and b["status"] == "pending_payment"
    assert b["reference"].startswith("TFB-") and b["qr_token"] is None
    assert Decimal(b["payment"]["amount"]) == Decimal("156.80")

    p = _pay(pax, b)
    assert p.status_code == 200 and p.json()["status"] == "succeeded"
    assert p.json()["transaction_ref"].startswith("SIM-OK-")

    d = pax.get(f"/bookings/{b['id']}").json()
    assert d["status"] == "confirmed" and d["qr_token"]
    kind, code, _ = parse_qr_token(d["qr_token"], get_settings().qr_signing_key)
    assert kind == "B" and code == b["reference"]
    # no personal data in the QR payload
    assert "@" not in d["qr_token"] and "Demo" not in d["qr_token"]


def test_payment_is_idempotent(pax, route101):
    b = _book(pax, route101)
    assert _pay(pax, b).status_code == 200
    assert _pay(pax, b).status_code == 200
    assert _pay(pax, b).json()["status"] == "succeeded"
    assert len([x for x in pax.get("/payments").json() if x["status"] == "succeeded"]) == 1


def test_declined_payment_never_confirms(pax, route101):
    b = _book(pax, route101)
    r = _pay(pax, b, "failure")
    assert r.status_code == 402
    assert pax.get(f"/bookings/{b['id']}").json()["status"] == "pending_payment"
    assert _pay(pax, b, "success").status_code == 200
    assert pax.get(f"/bookings/{b['id']}").json()["status"] == "confirmed"


def test_client_cannot_mark_payment_paid(pax, route101):
    b = _book(pax, route101)
    for body in ({"status": "succeeded"}, {"paid": True}):
        r = pax.post(f"/payments/{b['payment']['id']}/pay", body)
        # unknown fields are ignored; the provider decides (default simulated success)
        assert r.status_code == 200
    # but there is no endpoint to set status directly
    assert pax.patch(f"/payments/{b['payment']['id']}", {"status": "succeeded"}).status_code in (404, 405)


def test_duplicate_and_conflicting_bookings_blocked(pax, route101):
    b = _book(pax, route101, time="06:30")
    r = pax.post("/bookings", booking_payload(route101, time="06:30"))
    assert r.status_code == 409 and b["reference"] in r.json()["detail"]
    # same slot, other route/stops is also a conflict (06:30 is on both timetables)
    other = pax.get("/routes", params={"q": "DEMO-103"}).json()["items"][0]
    r = pax.post("/bookings", booking_payload(other, time="06:30"))
    assert r.status_code == 409
    # different time is fine
    assert pax.post("/bookings", booking_payload(route101, time="11:00")).status_code == 201


def test_rebooking_allowed_after_cancel(pax, route101):
    b = _book(pax, route101)
    assert pax.post(f"/bookings/{b['id']}/cancel").status_code == 200
    assert pax.post("/bookings", booking_payload(route101)).status_code == 201


def test_invalid_departure_rejected(pax, route101):
    assert pax.post("/bookings", booking_payload(route101, time="10:10")).status_code == 422  # not on timetable
    assert pax.post("/bookings", booking_payload(route101, days=-1)).status_code == 422
    assert pax.post("/bookings", booking_payload(route101, days=90)).status_code == 422
    assert pax.post("/bookings", booking_payload(route101, passengers=9)).status_code == 422


def test_users_cannot_see_or_pay_others_bookings(pax, route101):
    b = _book(pax, route101)
    other = Api()
    other.register("other@example.com")
    assert other.get(f"/bookings/{b['id']}").status_code == 404
    assert other.post(f"/bookings/{b['id']}/cancel").status_code == 404
    assert other.post(f"/payments/{b['payment']['id']}/pay").status_code == 404
    assert other.get("/bookings").json() == []


def test_cancellation_policy_refunds(pax, route101, monkeypatch, db):
    # >= 24h: full refund
    b = _book(pax, route101, days=5)
    _pay(pax, b)
    r = pax.post(f"/bookings/{b['id']}/cancel")
    assert r.status_code == 200
    out = r.json()
    assert out["status"] == "cancelled" and Decimal(out["refund_amount"]) == Decimal(out["total_fare"])
    assert out["payment"]["status"] == "refunded"

    # between 2h and 24h: 50%
    b2 = _book(pax, route101, days=5, time="12:00")
    _pay(pax, b2)
    dep = booking_service.departure_dt(datetime.fromisoformat(b2["travel_date"]).date(), datetime.strptime("12:00", "%H:%M").time())
    monkeypatch.setattr(booking_service, "now_local", lambda: dep - timedelta(hours=10))
    out = pax.post(f"/bookings/{b2['id']}/cancel").json()
    assert Decimal(out["refund_amount"]) == Decimal(out["total_fare"]) / 2
    assert out["payment"]["status"] == "partially_refunded"

    # < 2h: not allowed
    b3 = _book(pax, route101, days=5, time="13:00")
    _pay(pax, b3)
    dep3 = booking_service.departure_dt(datetime.fromisoformat(b3["travel_date"]).date(), datetime.strptime("13:00", "%H:%M").time())
    monkeypatch.setattr(booking_service, "now_local", lambda: dep3 - timedelta(hours=1))
    r = pax.post(f"/bookings/{b3['id']}/cancel")
    assert r.status_code == 409 and "2 hours" in r.json()["detail"]


def test_cancel_twice_conflicts(pax, route101):
    b = _book(pax, route101)
    _pay(pax, b)
    assert pax.post(f"/bookings/{b['id']}/cancel").status_code == 200
    assert pax.post(f"/bookings/{b['id']}/cancel").status_code == 409


def test_unpaid_hold_expires(pax, route101, db):
    b = _book(pax, route101)
    row = db.get(Booking, b["id"])
    row.hold_expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    r = _pay(pax, b)
    assert r.status_code == 409
    assert pax.get(f"/bookings/{b['id']}").json()["status"] == "expired"
    # slot is free again
    assert pax.post("/bookings", booking_payload(route101)).status_code == 201


def test_history_and_dashboard(pax, route101):
    b = _book(pax, route101)
    _pay(pax, b)
    hist = pax.get("/bookings").json()
    assert len(hist) == 1 and hist[0]["reference"] == b["reference"]
    d = pax.get("/dashboard").json()
    assert d["stats"]["confirmed_trips"] == 1 and len(d["upcoming_journeys"]) == 1
    assert d["active_pass"] is None


def test_payment_rows_record_status_and_reference(pax, route101, db):
    b = _book(pax, route101)
    _pay(pax, b)
    p = db.get(Payment, b["payment"]["id"])
    assert p.status == "succeeded" and p.provider_ref.startswith("SIM-") and p.reference.startswith("TFT-")
