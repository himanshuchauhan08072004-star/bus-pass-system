"""Clearly-labelled DEMONSTRATION data for local development and evaluation.

Every route code starts with DEMO-. Nothing here is real timetable or fare data.
"""
from datetime import time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Bus, FareRule, PassType, Route, RouteStop, Stop, User

DEMO_ADMIN_EMAIL = "admin@transitflow.demo"
DEMO_PASSENGER_EMAIL = "passenger@transitflow.demo"

STOPS = [
    ("Gurugram Bus Stand", "Gurugram"),
    ("Sector 29", "Gurugram"),
    ("IFFCO Chowk", "Gurugram"),
    ("Sikanderpur", "Gurugram"),
    ("Dhaula Kuan", "Delhi"),
    ("AIIMS", "Delhi"),
    ("Kashmere Gate ISBT", "Delhi"),
    ("Rewari Bus Stand", "Rewari"),
    ("Manesar", "Gurugram"),
    ("Bilaspur Chowk", "Gurugram"),
    ("Dwarka Sector 21", "Delhi"),
    ("IGI Airport T3", "Delhi"),
    ("Faridabad Bus Stand", "Faridabad"),
    ("Badarpur Border", "Delhi"),
    ("Nehru Place", "Delhi"),
]

# code, name, start, end, frequency, fare(base, per_km, min), [(stop, cumulative_km)]
ROUTES = [
    ("DEMO-101", "Gurugram - Delhi ISBT Express", time(5, 30), time(22, 30), 30, ("10", "1.80", "10"),
     [("Gurugram Bus Stand", "0"), ("Sector 29", "4"), ("IFFCO Chowk", "6.5"), ("Sikanderpur", "8"),
      ("Dhaula Kuan", "22"), ("AIIMS", "28.5"), ("Kashmere Gate ISBT", "38")]),
    ("DEMO-102", "Rewari - Gurugram Connector", time(5, 0), time(21, 0), 45, ("15", "1.50", "15"),
     [("Rewari Bus Stand", "0"), ("Manesar", "32"), ("Bilaspur Chowk", "42"), ("Gurugram Bus Stand", "55")]),
    ("DEMO-103", "Gurugram - IGI Airport Shuttle", time(4, 30), time(23, 30), 20, ("20", "2.20", "20"),
     [("Gurugram Bus Stand", "0"), ("IFFCO Chowk", "6.5"), ("Dwarka Sector 21", "22"), ("IGI Airport T3", "30")]),
    ("DEMO-104", "Faridabad - Nehru Place", time(6, 0), time(21, 0), 30, ("10", "1.70", "10"),
     [("Faridabad Bus Stand", "0"), ("Badarpur Border", "15"), ("Nehru Place", "23")]),
]

PASS_TYPES = [
    ("Monthly General", "30-day pass for all routes. Demo pricing.", 30, "1200", "general"),
    ("Quarterly General", "90-day pass for all routes. Demo pricing.", 90, "3300", "general"),
    ("Annual General", "365-day pass for all routes. Demo pricing.", 365, "11000", "general"),
    ("Student Monthly", "30-day concession pass. Requires institution details; verified by an administrator.", 30, "450", "student"),
    ("Senior Citizen Monthly", "30-day concession pass. Requires ID details; verified by an administrator.", 30, "300", "senior"),
]


def seed_demo(db: Session, admin_password: str, passenger_password: str) -> dict:
    created = {"users": 0, "stops": 0, "routes": 0, "pass_types": 0, "buses": 0}

    for email, name, role, pw in (
        (DEMO_ADMIN_EMAIL, "Demo Administrator", "admin", admin_password),
        (DEMO_PASSENGER_EMAIL, "Demo Passenger", "passenger", passenger_password),
    ):
        if db.scalar(select(User.id).where(User.email == email)) is None:
            db.add(User(email=email, full_name=name, role=role, password_hash=hash_password(pw)))
            created["users"] += 1

    stops: dict[str, Stop] = {}
    for name, city in STOPS:
        s = db.scalar(select(Stop).where(Stop.name == name))
        if s is None:
            s = Stop(name=name, city=city)
            db.add(s)
            created["stops"] += 1
        stops[name] = s
    db.flush()

    for code, name, start, end, freq, (base, per_km, min_fare), path in ROUTES:
        route = db.scalar(select(Route).where(Route.code == code))
        if route is not None:
            continue
        route = Route(code=code, name=name, operating_start=start, operating_end=end, frequency_minutes=freq)
        route.fare_rule = FareRule(base_fare=Decimal(base), per_km_rate=Decimal(per_km), min_fare=Decimal(min_fare))
        for i, (stop_name, km) in enumerate(path, start=1):
            route.route_stops.append(RouteStop(stop_id=stops[stop_name].id, sequence=i, distance_km=Decimal(km)))
        db.add(route)
        db.flush()
        for n in (1, 2):
            reg = f"DEMO-{code[-3:]}-{n:02d}"
            if db.scalar(select(Bus.id).where(Bus.registration_number == reg)) is None:
                db.add(Bus(registration_number=reg, capacity=45, route_id=route.id))
                created["buses"] += 1
        created["routes"] += 1

    for name, desc, days, price, elig in PASS_TYPES:
        if db.scalar(select(PassType.id).where(PassType.name == name)) is None:
            db.add(PassType(name=name, description=desc, duration_days=days, price=Decimal(price), eligibility=elig))
            created["pass_types"] += 1

    db.commit()
    return created
