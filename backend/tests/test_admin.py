import pytest

from tests.conftest import booking_payload


ADMIN_GETS = ["/admin/stats", "/admin/stops", "/admin/buses", "/admin/routes", "/admin/pass-types",
              "/admin/pass-applications", "/admin/users", "/admin/bookings", "/admin/payments", "/admin/audit-logs"]


@pytest.mark.parametrize("url", ADMIN_GETS)
def test_admin_endpoints_forbidden_for_passengers_and_anonymous(url, pax, api):
    assert pax.get(url).status_code == 403
    assert api.get(url).status_code == 401


def test_admin_mutations_forbidden_for_passengers(pax):
    assert pax.post("/admin/stops", {"name": "Hack Stop", "city": "X"}).status_code == 403
    assert pax.put("/admin/routes/1/fare", {"base_fare": "0", "per_km_rate": "0", "min_fare": "0"}).status_code == 403
    assert pax.post("/admin/pass-types", {"name": "Free", "duration_days": 30, "price": "0"}).status_code == 403
    assert pax.patch("/admin/users/1", {"role": "admin"}).status_code == 403


def test_stats_shape(admin, pax, route101):
    b = pax.post("/bookings", booking_payload(route101)).json()
    pax.post(f"/payments/{b['payment']['id']}/pay")
    s = admin.get("/admin/stats").json()
    assert s["total_passengers"] == 1 and s["bookings_by_status"]["confirmed"] == 1
    assert s["net_revenue"] == "78.40" and s["routes"] == 4 and s["buses"] == 8
    assert s["top_routes"][0]["code"] == "DEMO-101"
    assert s["recent_activity"]


def test_stop_route_fare_crud_and_audit(admin):
    s1 = admin.post("/admin/stops", {"name": "Test Stop A", "city": "Gurugram"}).json()
    s2 = admin.post("/admin/stops", {"name": "Test Stop B", "city": "Gurugram"}).json()
    assert admin.post("/admin/stops", {"name": "Test Stop A", "city": "x"}).status_code == 409

    r = admin.post("/admin/routes", {"code": "t-1", "name": "Test Route", "operating_start": "06:00", "operating_end": "20:00", "frequency_minutes": 60})
    assert r.status_code == 201 and r.json()["code"] == "T-1"
    rid = r.json()["id"]
    assert admin.post("/admin/routes", {"code": "T-1", "name": "Dup", "operating_start": "06:00", "operating_end": "20:00", "frequency_minutes": 60}).status_code == 409
    assert admin.post("/admin/routes", {"code": "T-2", "name": "Bad hours", "operating_start": "20:00", "operating_end": "06:00", "frequency_minutes": 60}).status_code == 422

    bad = admin.put(f"/admin/routes/{rid}/stops", {"stops": [{"stop_id": s1["id"], "distance_km": "1"}, {"stop_id": s2["id"], "distance_km": "5"}]})
    assert bad.status_code == 422  # first stop must be 0
    ok = admin.put(f"/admin/routes/{rid}/stops", {"stops": [{"stop_id": s1["id"], "distance_km": "0"}, {"stop_id": s2["id"], "distance_km": "5"}]})
    assert ok.status_code == 200 and [x["sequence"] for x in ok.json()["stops"]] == [1, 2]

    f = admin.put(f"/admin/routes/{rid}/fare", {"base_fare": "5", "per_km_rate": "2", "min_fare": "12"})
    assert f.status_code == 200 and f.json()["fare"]["min_fare"] == "12.00"
    assert admin.put(f"/admin/routes/{rid}/fare", {"base_fare": "-1", "per_km_rate": "2", "min_fare": "12"}).status_code == 422

    # the new route is immediately bookable at the new fare: 5 + 2*5 = 15
    q = admin.get("/fare-quote", params={"route_id": rid, "from_stop_id": s1["id"], "to_stop_id": s2["id"]}).json()
    assert q["unit_fare"] == "15.00"

    logs = admin.get("/admin/audit-logs", params={"action": "admin."}).json()
    actions = {x["action"] for x in logs["items"]}
    assert {"admin.route.create", "admin.route.stops", "admin.fare.update"} <= actions
    assert all(x["actor_email"] == "admin@transitflow.demo" for x in logs["items"])

    assert admin.delete(f"/admin/routes/{rid}").status_code == 204
    assert admin.delete(f"/admin/stops/{s1['id']}").status_code == 204


def test_cannot_delete_route_with_bookings(admin, pax, route101):
    pax.post("/bookings", booking_payload(route101))
    assert admin.delete(f"/admin/routes/{route101['id']}").status_code == 409
    stops = [{"stop_id": s["stop_id"], "distance_km": s["distance_km"]} for s in route101["stops"]]
    assert admin.put(f"/admin/routes/{route101['id']}/stops", {"stops": stops}).status_code == 409


def test_buses_crud(admin):
    r = admin.post("/admin/buses", {"registration_number": "hr26-t-0001", "capacity": 40})
    assert r.status_code == 201 and r.json()["registration_number"] == "HR26-T-0001"
    assert admin.post("/admin/buses", {"registration_number": "HR26-T-0001", "capacity": 40}).status_code == 409
    assert admin.post("/admin/buses", {"registration_number": "HR26-T-0002", "capacity": 0}).status_code == 422
    bid = r.json()["id"]
    assert admin.put(f"/admin/buses/{bid}", {"registration_number": "HR26-T-0001", "capacity": 50, "status": "maintenance"}).json()["status"] == "maintenance"
    assert admin.delete(f"/admin/buses/{bid}").status_code == 204


def test_pass_type_price_change_only_affects_new_applications(admin, pax):
    pt = next(t for t in pax.get("/pass-types").json() if t["name"] == "Monthly General")
    app1 = pax.post("/passes/applications", {"pass_type_id": pt["id"]}).json()
    upd = admin.put(f"/admin/pass-types/{pt['id']}", {"name": "Monthly General", "description": "", "duration_days": 30, "price": "1500", "eligibility": "general", "is_active": True})
    assert upd.status_code == 200
    assert pax.get("/passes/applications").json()[0]["price"] == app1["price"]
    assert admin.get("/admin/pass-applications").json()["total"] == 1


def test_admin_cancel_booking_full_refund(admin, pax, route101):
    b = pax.post("/bookings", booking_payload(route101)).json()
    pax.post(f"/payments/{b['payment']['id']}/pay")
    r = admin.post(f"/admin/bookings/{b['id']}/cancel", {"reason": "Route suspended"})
    assert r.status_code == 200 and r.json()["payment"]["status"] == "refunded"
    assert admin.get("/admin/payments", params={"status": "refunded"}).json()["total"] == 1
    assert admin.get("/admin/bookings", params={"q": b["reference"][:8]}).json()["total"] == 1


def test_admin_cannot_change_own_role(admin):
    me = admin.get("/auth/me").json()
    assert admin.patch(f"/admin/users/{me['id']}", {"role": "passenger"}).status_code == 409


def test_role_promotion_is_audited(admin, api):
    api.register("promo@example.com")
    uid = api.get("/auth/me").json()["id"]
    assert admin.patch(f"/admin/users/{uid}", {"role": "admin"}).status_code == 200
    logs = admin.get("/admin/audit-logs", params={"action": "admin.user"}).json()["items"]
    assert logs and logs[0]["details"] == {"role": "admin"}
