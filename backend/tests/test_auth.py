import pytest

from app.core.security import hash_password, verify_password
from tests.conftest import ADMIN_PW, PAX_PW


def test_password_hash_is_argon2id():
    h = hash_password("Another-Passw0rd")
    assert h.startswith("$argon2id$")
    assert verify_password(h, "Another-Passw0rd")
    assert not verify_password(h, "wrong")


def test_register_login_logout_flow(api):
    r = api.register("new@example.com")
    assert r.json()["role"] == "passenger"
    assert "password" not in r.text
    assert api.get("/auth/me").json()["email"] == "new@example.com"
    assert api.post("/auth/logout").status_code == 200
    assert api.get("/auth/me").status_code == 401
    api.login("new@example.com", "Sup3rSecret-pass")
    assert api.get("/auth/me").status_code == 200


def test_session_cookie_flags(api):
    r = api.post("/auth/register", {"email": "c@example.com", "password": "Sup3rSecret-pass", "full_name": "Cookie Test"})
    cookies = r.headers.get_list("set-cookie")
    sess = next(c for c in cookies if c.startswith("tf_session="))
    assert "HttpOnly" in sess and "SameSite=lax" in sess
    csrf = next(c for c in cookies if c.startswith("tf_csrf="))
    assert "HttpOnly" not in csrf


@pytest.mark.parametrize("pw", ["short1", "alllettersnodigits", "1234567890123"])
def test_weak_passwords_rejected(api, pw):
    r = api.post("/auth/register", {"email": "w@example.com", "password": pw, "full_name": "Weak Pw"})
    assert r.status_code == 422


def test_duplicate_email_rejected(api):
    api.register("dup@example.com")
    r = api.post("/auth/register", {"email": "DUP@example.com", "password": "Sup3rSecret-pass", "full_name": "Dup Two"})
    assert r.status_code == 409


def test_login_errors_are_generic(api):
    a = api.post("/auth/login", {"email": "nobody@example.com", "password": "whatever-123"})
    b = api.post("/auth/login", {"email": "passenger@transitflow.demo", "password": "bad-password-1"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_protected_endpoint_requires_auth(api):
    assert api.get("/dashboard").status_code == 401
    assert api.get("/bookings").status_code == 401


def test_csrf_required_for_mutations(pax):
    pax.c.cookies.delete("tf_csrf")
    r = pax.c.post("/api/v1/auth/change-password", json={"current_password": PAX_PW, "new_password": "NewPassw0rd-123"})
    assert r.status_code == 403
    r = pax.c.post(
        "/api/v1/auth/change-password",
        json={"current_password": PAX_PW, "new_password": "NewPassw0rd-123"},
        headers={"X-CSRF-Token": "forged"},
    )
    assert r.status_code == 403


def test_role_comes_from_database_not_client(pax):
    # Passenger cannot reach admin endpoints; a forged role field is ignored.
    assert pax.get("/admin/stats").status_code == 403
    r = pax.patch("/auth/me", {"full_name": "Renamed User", "role": "admin"})
    assert r.status_code == 200 and r.json()["role"] == "passenger"
    assert pax.get("/admin/stats").status_code == 403


def test_change_password_revokes_other_sessions(pax):
    other = type(pax)()
    other.login("passenger@transitflow.demo", PAX_PW)
    assert other.get("/auth/me").status_code == 200
    r = pax.post("/auth/change-password", {"current_password": PAX_PW, "new_password": "NewPassw0rd-123"})
    assert r.status_code == 200
    assert pax.get("/auth/me").status_code == 200  # current session re-issued
    assert other.get("/auth/me").status_code == 401  # old session revoked


def test_deactivated_user_loses_access(admin, pax):
    uid = pax.get("/auth/me").json()["id"]
    assert admin.patch(f"/admin/users/{uid}", {"is_active": False}).status_code == 200
    assert pax.get("/auth/me").status_code == 401
    other = type(pax)()
    r = other.post("/auth/login", {"email": "passenger@transitflow.demo", "password": PAX_PW})
    assert r.status_code == 401


def test_admin_login_works(admin):
    assert admin.get("/auth/me").json()["role"] == "admin"
    assert admin.get("/admin/stats").status_code == 200
