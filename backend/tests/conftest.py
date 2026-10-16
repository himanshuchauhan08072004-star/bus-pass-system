import os

# Must be set before the app is imported.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite+pysqlite://")
os.environ["ENVIRONMENT"] = "test"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key-test-secret-key-0123456789"
os.environ["QR_SIGNING_KEY"] = "test-qr-signing-key-test-qr-key-0123456789"

from datetime import timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core import rate_limit  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.timeutil import today_local  # noqa: E402
from app.main import app  # noqa: E402
from app.seed_data import DEMO_ADMIN_EMAIL, DEMO_PASSENGER_EMAIL, seed_demo  # noqa: E402

ADMIN_PW = "AdminPass-12345"
PAX_PW = "PassengerPass-12345"


class Api:
    """TestClient wrapper that echoes the CSRF cookie like the browser app does."""

    def __init__(self):
        self.c = TestClient(app)

    def _h(self, extra=None):
        h = dict(extra or {})
        csrf = self.c.cookies.get("tf_csrf")
        if csrf:
            h["X-CSRF-Token"] = csrf
        return h

    def get(self, url, **kw):
        return self.c.get("/api/v1" + url, **kw)

    def post(self, url, json=None, headers=None, **kw):
        return self.c.post("/api/v1" + url, json=json, headers=self._h(headers), **kw)

    def put(self, url, json=None, **kw):
        return self.c.put("/api/v1" + url, json=json, headers=self._h(), **kw)

    def patch(self, url, json=None, **kw):
        return self.c.patch("/api/v1" + url, json=json, headers=self._h(), **kw)

    def delete(self, url, **kw):
        return self.c.delete("/api/v1" + url, headers=self._h(), **kw)

    def login(self, email, password):
        r = self.post("/auth/login", {"email": email, "password": password})
        assert r.status_code == 200, r.text
        return r

    def register(self, email, password="Sup3rSecret-pass", name="Test User"):
        r = self.post("/auth/register", {"email": email, "password": password, "full_name": name})
        assert r.status_code == 201, r.text
        return r


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    rate_limit.reset_all()
    with SessionLocal() as db:
        seed_demo(db, ADMIN_PW, PAX_PW)
    yield


@pytest.fixture
def api():
    return Api()


@pytest.fixture
def pax():
    a = Api()
    a.login(DEMO_PASSENGER_EMAIL, PAX_PW)
    return a


@pytest.fixture
def admin():
    a = Api()
    a.login(DEMO_ADMIN_EMAIL, ADMIN_PW)
    return a


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


@pytest.fixture
def route101(api):
    r = api.get("/routes", params={"q": "DEMO-101"}).json()["items"][0]
    return r


def future_date(days=5):
    return (today_local() + timedelta(days=days)).isoformat()


def booking_payload(route, days=5, time="10:00", passengers=1, frm=0, to=-1):
    stops = route["stops"]
    return {
        "route_id": route["id"],
        "from_stop_id": stops[frm]["stop_id"],
        "to_stop_id": stops[to]["stop_id"],
        "travel_date": future_date(days),
        "departure_time": time,
        "passengers": passengers,
    }
