from datetime import timedelta
from decimal import Decimal

from app.models import BusPass
from app.core.timeutil import today_local
from tests.conftest import Api


def _type(api, name):
    return next(t for t in api.get("/pass-types").json() if t["name"] == name)


def _apply_and_pay(pax, name="Monthly General", declaration=None):
    pt = _type(pax, name)
    r = pax.post("/passes/applications", {"pass_type_id": pt["id"], "declaration": declaration})
    assert r.status_code == 201, r.text
    app = r.json()
    p = pax.post(f"/payments/{app['payment']['id']}/pay")
    assert p.status_code == 200
    return app


def test_apply_price_from_server_and_admin_approval(pax, admin):
    pt = _type(pax, "Monthly General")
    r = pax.post("/passes/applications", {"pass_type_id": pt["id"], "price": "1.00"})
    assert r.status_code == 201
    app = r.json()
    assert Decimal(app["price"]) == Decimal(pt["price"]) and app["status"] == "pending"

    # admin cannot approve before payment is verified
    assert admin.post(f"/admin/pass-applications/{app['id']}/approve").status_code == 409

    assert pax.post(f"/payments/{app['payment']['id']}/pay").status_code == 200
    assert pax.get("/passes").json() == []  # still awaiting review

    r = admin.post(f"/admin/pass-applications/{app['id']}/approve", {"note": "ok"})
    assert r.status_code == 200 and r.json()["status"] == "active"

    passes = pax.get("/passes").json()
    assert len(passes) == 1
    p = passes[0]
    assert p["status"] == "active" and p["qr_token"] and p["pass_code"].startswith("TFP-")
    assert (today_local() - today_local()).days == 0
    assert p["days_left"] == 29
    assert pax.get("/dashboard").json()["active_pass"]["pass_code"] == p["pass_code"]


def test_reject_refunds_payment(pax, admin):
    app = _apply_and_pay(pax)
    r = admin.post(f"/admin/pass-applications/{app['id']}/reject", {"note": "ID unclear"})
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    mine = pax.get("/passes/applications").json()[0]
    assert mine["status"] == "rejected" and mine["payment"]["status"] == "refunded"
    assert pax.get("/passes").json() == []
    # cannot review twice
    assert admin.post(f"/admin/pass-applications/{app['id']}/approve").status_code == 409


def test_concession_requires_declaration(pax):
    pt = _type(pax, "Student Monthly")
    assert pax.post("/passes/applications", {"pass_type_id": pt["id"]}).status_code == 422
    r = pax.post("/passes/applications", {"pass_type_id": pt["id"], "declaration": "GITM Gurugram, roll 1234"})
    assert r.status_code == 201


def test_duplicate_pending_application_blocked(pax):
    pt = _type(pax, "Monthly General")
    assert pax.post("/passes/applications", {"pass_type_id": pt["id"]}).status_code == 201
    assert pax.post("/passes/applications", {"pass_type_id": pt["id"]}).status_code == 409


def test_cannot_reapply_while_pass_active(pax, admin):
    app = _apply_and_pay(pax)
    admin.post(f"/admin/pass-applications/{app['id']}/approve")
    pt = _type(pax, "Monthly General")
    assert pax.post("/passes/applications", {"pass_type_id": pt["id"]}).status_code == 409


def test_renewal_rules_and_auto_approval(pax, admin, db):
    app = _apply_and_pay(pax)
    admin.post(f"/admin/pass-applications/{app['id']}/approve")
    p = pax.get("/passes").json()[0]
    assert p["can_renew"] is False
    assert pax.post(f"/passes/{p['id']}/renew").status_code == 409  # too early

    row = db.get(BusPass, p["id"])
    row.valid_from = today_local() - timedelta(days=27)
    row.valid_to = today_local() + timedelta(days=3)
    db.commit()
    d = pax.get("/dashboard").json()
    assert any("expires in 3 days" in x for x in d["reminders"])
    assert pax.get("/passes").json()[0]["can_renew"] is True

    r = pax.post(f"/passes/{p['id']}/renew")
    assert r.status_code == 201 and r.json()["is_renewal"] is True
    ren = r.json()
    assert pax.post(f"/passes/{p['id']}/renew").status_code == 409  # pending renewal
    assert pax.post(f"/payments/{ren['payment']['id']}/pay").status_code == 200  # auto-approves

    passes = pax.get("/passes").json()
    assert len(passes) == 2
    newest = max(passes, key=lambda x: x["valid_to"])
    assert newest["valid_from"] == (today_local() + timedelta(days=4)).isoformat()
    assert newest["status"] == "upcoming"
    assert pax.post(f"/passes/{p['id']}/renew").status_code == 409  # already renewed


def test_expired_pass_status_and_no_qr(pax, admin, db):
    app = _apply_and_pay(pax)
    admin.post(f"/admin/pass-applications/{app['id']}/approve")
    p = pax.get("/passes").json()[0]
    row = db.get(BusPass, p["id"])
    row.valid_from = today_local() - timedelta(days=40)
    row.valid_to = today_local() - timedelta(days=10)
    db.commit()
    p = pax.get("/passes").json()[0]
    assert p["status"] == "expired" and p["qr_token"] is None and p["can_renew"] is True
    assert pax.get("/passes/applications").json()[0]["status"] == "expired"


def test_users_cannot_access_others_passes(pax, admin):
    app = _apply_and_pay(pax)
    admin.post(f"/admin/pass-applications/{app['id']}/approve")
    pid = pax.get("/passes").json()[0]["id"]
    other = Api()
    other.register("other2@example.com")
    assert other.get(f"/passes/{pid}").status_code == 404
    assert other.post(f"/passes/{pid}/renew").status_code == 404
