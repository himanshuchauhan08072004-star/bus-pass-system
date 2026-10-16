from app.core.security import make_qr_token, parse_qr_token
from app.core.config import get_settings
from tests.conftest import booking_payload


def _confirmed_booking(pax, route, days=0, time=None):
    from datetime import datetime
    from app.core.timeutil import now_local
    b = pax.post("/bookings", booking_payload(route, days=5)).json()
    pax.post(f"/payments/{b['payment']['id']}/pay")
    return pax.get(f"/bookings/{b['id']}").json()


def test_valid_ticket_for_future_date_is_flagged(pax, route101, api):
    b = _confirmed_booking(pax, route101)
    r = api.post("/verify", {"token": b["qr_token"]}).json()
    assert r["valid"] is False and "future" in r["reason"]  # signature fine, but not today
    assert r["code"] == b["reference"] and "@" not in str(r) and "Demo" not in str(r)


def test_ticket_valid_on_travel_day(pax, route101, api, db):
    from app.models import Booking
    from app.core.timeutil import today_local
    b = _confirmed_booking(pax, route101)
    row = db.get(Booking, b["id"])
    row.travel_date = today_local()
    db.commit()
    r = api.post("/verify", {"token": b["qr_token"]}).json()
    assert r["valid"] is True and r["summary"]["passengers"] == 1


def test_cancelled_ticket_fails_verification(pax, route101, api, db):
    from app.models import Booking
    from app.core.timeutil import today_local
    b = _confirmed_booking(pax, route101)
    row = db.get(Booking, b["id"]); row.travel_date = today_local(); db.commit()
    assert api.post("/verify", {"token": b["qr_token"]}).json()["valid"] is True
    row.status = "cancelled"; db.commit()
    r = api.post("/verify", {"token": b["qr_token"]}).json()
    assert r["valid"] is False and "cancelled" in r["reason"]


def test_tampered_or_forged_tokens_rejected(pax, route101, api):
    b = _confirmed_booking(pax, route101)
    parts = b["qr_token"].split(".")
    tampered = ".".join(parts[:2] + ["TFB-AAAAAAAAAA"] + parts[3:])
    assert api.post("/verify", {"token": tampered}).json()["valid"] is False
    forged = make_qr_token("B", b["reference"], "deadbeef0000", "wrong-key-wrong-key-wrong-key-0000")
    assert api.post("/verify", {"token": forged}).json()["valid"] is False
    # correctly signed but unknown nonce -> still rejected by DB check
    bad_nonce = make_qr_token("B", b["reference"], "deadbeef0000", get_settings().qr_signing_key)
    assert api.post("/verify", {"token": bad_nonce}).json()["valid"] is False
    assert api.post("/verify", {"token": "not-a-token-at-all"}).json()["valid"] is False


def test_pass_qr_verification(pax, admin, api, db):
    from app.models import BusPass
    pt = next(t for t in pax.get("/pass-types").json() if t["name"] == "Monthly General")
    a = pax.post("/passes/applications", {"pass_type_id": pt["id"]}).json()
    pax.post(f"/payments/{a['payment']['id']}/pay")
    admin.post(f"/admin/pass-applications/{a['id']}/approve")
    p = pax.get("/passes").json()[0]
    r = api.post("/verify", {"token": p["qr_token"]}).json()
    assert r["valid"] is True and r["kind"] == "pass" and r["summary"]["pass_type"] == "Monthly General"
    row = db.get(BusPass, p["id"]); row.status = "revoked"; db.commit()
    assert api.post("/verify", {"token": p["qr_token"]}).json()["valid"] is False


def test_qr_parse_roundtrip():
    key = "k" * 40
    tok = make_qr_token("P", "TFP-ABCDEFGHJK", "abc123abc123", key)
    assert parse_qr_token(tok, key) == ("P", "TFP-ABCDEFGHJK", "abc123abc123")
    assert parse_qr_token(tok, "other" * 8) is None
