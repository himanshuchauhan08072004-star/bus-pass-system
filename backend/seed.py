"""Seed demonstration data.  Usage (from backend/):  python seed.py

Passwords come from SEED_ADMIN_PASSWORD / SEED_PASSENGER_PASSWORD. If unset, a
random password is generated and printed ONCE. Nothing is hardcoded.
"""
import os
import secrets

from app.core.database import SessionLocal
from app.seed_data import DEMO_ADMIN_EMAIL, DEMO_PASSENGER_EMAIL, seed_demo


def _pw(env: str) -> tuple[str, bool]:
    v = os.environ.get(env)
    if v:
        return v, False
    return "Tf1-" + secrets.token_urlsafe(12), True


if __name__ == "__main__":
    if os.environ.get("ENVIRONMENT") == "production":
        raise SystemExit("Refusing to seed demo data in production.")
    admin_pw, admin_generated = _pw("SEED_ADMIN_PASSWORD")
    pax_pw, pax_generated = _pw("SEED_PASSENGER_PASSWORD")
    with SessionLocal() as db:
        created = seed_demo(db, admin_pw, pax_pw)
    print("Seeded demo data:", created)
    print("NOTE: passwords only apply to accounts created in THIS run.")
    print(f"  admin     {DEMO_ADMIN_EMAIL}  password: {admin_pw if admin_generated else '(from SEED_ADMIN_PASSWORD)'}")
    print(f"  passenger {DEMO_PASSENGER_EMAIL}  password: {pax_pw if pax_generated else '(from SEED_PASSENGER_PASSWORD)'}")
