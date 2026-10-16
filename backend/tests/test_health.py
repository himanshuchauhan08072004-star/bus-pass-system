def test_liveness(api):
    r = api.c.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_liveness_versioned(api):
    assert api.get("/health").status_code == 200


def test_readiness_checks_database(api):
    r = api.get("/health/ready")
    assert r.status_code == 200 and r.json() == {"status": "ready"}


def test_security_headers(api):
    r = api.c.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
