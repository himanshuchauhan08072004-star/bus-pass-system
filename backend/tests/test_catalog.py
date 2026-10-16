from decimal import Decimal


def test_list_and_search_routes(api):
    r = api.get("/routes").json()
    assert r["total"] == 4
    r = api.get("/routes", params={"origin": "gurugram bus", "destination": "airport"}).json()
    assert [x["code"] for x in r["items"]] == ["DEMO-103"]
    seg = r["items"][0]["segment"]
    assert seg["from_stop_name"] == "Gurugram Bus Stand" and seg["to_stop_name"] == "IGI Airport T3"
    # 20 + 2.20 * 30 = 86.00
    assert Decimal(seg["unit_fare"]) == Decimal("86.00")


def test_direction_matters(api):
    r = api.get("/routes", params={"origin": "airport", "destination": "gurugram bus"}).json()
    assert r["total"] == 0 and r["items"] == []


def test_no_results_is_graceful(api):
    r = api.get("/routes", params={"origin": "Atlantis", "destination": "Mars"})
    assert r.status_code == 200 and r.json() == {"items": [], "total": 0}


def test_sort_and_filter(api):
    fares = [Decimal(x["segment"]["unit_fare"]) for x in api.get("/routes", params={"origin": "Gurugram", "destination": "Delhi", "sort": "fare"}).json()["items"]]
    assert fares == sorted(fares) and len(fares) >= 1
    cheap = api.get("/routes", params={"max_fare": "20"}).json()["items"]
    assert all(Decimal(x["fare"]["min_fare"]) <= 20 for x in cheap)
    freq = api.get("/routes", params={"max_frequency": 20}).json()["items"]
    assert [x["code"] for x in freq] == ["DEMO-103"]


def test_fare_quote_computed_on_server(api, route101):
    s = route101["stops"]
    r = api.get("/fare-quote", params={"route_id": route101["id"], "from_stop_id": s[0]["stop_id"], "to_stop_id": s[-1]["stop_id"], "passengers": 2})
    assert r.status_code == 200
    d = r.json()
    # 10 + 1.80 * 38 = 78.40 per passenger
    assert Decimal(d["unit_fare"]) == Decimal("78.40") and Decimal(d["total_fare"]) == Decimal("156.80")


def test_fare_minimum_applies(api, route101):
    s = route101["stops"]
    d = api.get("/fare-quote", params={"route_id": route101["id"], "from_stop_id": s[0]["stop_id"], "to_stop_id": s[1]["stop_id"]}).json()
    assert Decimal(d["unit_fare"]) == Decimal("17.20")  # 10 + 1.8*4


def test_quote_rejects_reverse_and_foreign_stops(api, route101):
    s = route101["stops"]
    r = api.get("/fare-quote", params={"route_id": route101["id"], "from_stop_id": s[-1]["stop_id"], "to_stop_id": s[0]["stop_id"]})
    assert r.status_code == 422
    other = api.get("/routes", params={"q": "DEMO-104"}).json()["items"][0]["stops"][0]["stop_id"]
    r = api.get("/fare-quote", params={"route_id": route101["id"], "from_stop_id": other, "to_stop_id": s[-1]["stop_id"]})
    assert r.status_code == 422


def test_departures(api, route101):
    from tests.conftest import future_date
    r = api.get(f"/routes/{route101['id']}/departures", params={"date": future_date(3)}).json()
    assert r["times"][0] == "05:30:00" and r["times"][1] == "06:00:00"


def test_pass_types_public(api):
    items = api.get("/pass-types").json()
    assert len(items) == 5 and all(x["is_active"] for x in items)
