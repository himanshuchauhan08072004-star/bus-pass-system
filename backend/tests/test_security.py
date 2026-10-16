import pytest

from app.core import rate_limit
from app.core.config import Settings, get_settings
from app.core.database import Base, engine
from app.models import User
from sqlalchemy import select, text

SQLI = ["' OR '1'='1", "'; DROP TABLE users; --", "\" OR 1=1 --", "1; SELECT pg_sleep(5)", "%' UNION SELECT password_hash FROM users --"]


@pytest.mark.parametrize("payload", SQLI)
def test_sql_injection_strings_are_inert(payload, api, db):
    for params in ({"origin": payload}, {"destination": payload}, {"q": payload}):
        r = api.get("/routes", params=params)
        assert r.status_code == 200 and r.json()["items"] == []
    assert api.get("/stops", params={"q": payload}).status_code == 200
    r = api.post("/auth/login", {"email": "a@example.com", "password": payload})
    assert r.status_code == 401
    r = api.post("/auth/login", {"email": payload, "password": "x"})
    assert r.status_code == 422
    # tables still intact
    assert db.scalar(select(User.id).limit(1)) is not None
    assert db.execute(text("SELECT count(*) FROM routes")).scalar() == 4


def test_sqli_in_admin_search(admin):
    for p in SQLI:
        assert admin.get("/admin/users", params={"q": p}).status_code == 200
        assert admin.get("/admin/bookings", params={"q": p}).status_code in (200, 422)  # 422: over length limit


def test_login_rate_limit(api, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    get_settings.cache_clear()
    try:
        rate_limit.reset_all()
        codes = [api.post("/auth/login", {"email": f"x{i}@example.com", "password": "wrong-pass-1"}).status_code for i in range(12)]
        assert 429 in codes and codes[0] == 401
        r = api.post("/auth/login", {"email": "y@example.com", "password": "wrong-pass-1"})
        assert r.status_code == 429 and r.headers["retry-after"]
    finally:
        monkeypatch.delenv("RATE_LIMIT_ENABLED", raising=False)
        monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
        get_settings.cache_clear()
        rate_limit.reset_all()


def test_cors_rejects_unknown_origin(api):
    r = api.c.get("/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers
    r = api.c.get("/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_unhandled_errors_do_not_leak_details(api):
    r = api.get("/routes/999999")
    assert r.status_code == 404 and "Traceback" not in r.text


def test_validation_errors_are_readable(api):
    r = api.post("/auth/register", {"email": "not-an-email", "password": "x", "full_name": "A"})
    assert r.status_code == 422 and "errors" in r.json()


def test_responses_never_include_password_hash(admin, pax):
    assert "password_hash" not in admin.get("/admin/users").text
    assert "argon2" not in admin.get("/admin/users").text
    assert "argon2" not in pax.get("/auth/me").text


def test_production_config_guards():
    base = dict(environment="production", secret_key="a" * 40, qr_signing_key="b" * 40, cookie_secure=True,
                payment_provider="simulated", allow_simulated_payments_in_production=True)
    Settings(**base).assert_production_safe()
    for bad in (
        {"secret_key": "dev-only-insecure-key-xxxxxxxxxxxxxxxxxxxxxxx"},
        {"secret_key": "short"},
        {"qr_signing_key": "a" * 40},
        {"cookie_secure": False},
        {"allow_simulated_payments_in_production": False},
    ):
        with pytest.raises(RuntimeError):
            Settings(**{**base, **bad}).assert_production_safe()


def test_csrf_blocks_cross_site_style_post(pax, route101):
    from tests.conftest import booking_payload
    r = pax.c.post("/api/v1/bookings", json=booking_payload(route101))  # no X-CSRF-Token header
    assert r.status_code == 403
