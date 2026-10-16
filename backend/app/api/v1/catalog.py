from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import NotFoundError
from app.core.timeutil import now_local
from app.models import PassType, Route, RouteStop, Stop
from app.schemas.schemas import DeparturesOut, FareQuoteOut, PassTypeOut, RouteListOut, RouteOut, StopOut
from app.services import bookings as booking_service
from app.services import pricing
from app.services.serializers import route_out

router = APIRouter(tags=["catalog"])


def _load_routes_stmt():
    return select(Route).options(
        selectinload(Route.route_stops).selectinload(RouteStop.stop), selectinload(Route.fare_rule)
    )


def _matches(rs: RouteStop, text: str) -> bool:
    t = text.lower()
    return t in rs.stop.name.lower() or t in (rs.stop.city or "").lower()


def _segment(route: Route, origin: str | None, destination: str | None) -> tuple[bool, dict | None]:
    """Returns (route_matches, segment)."""
    stops = route.route_stops
    if origin and destination:
        for o in stops:
            if not _matches(o, origin):
                continue
            for d in stops:
                if d.sequence > o.sequence and _matches(d, destination):
                    seg = None
                    if route.fare_rule is not None:
                        dist = Decimal(d.distance_km) - Decimal(o.distance_km)
                        seg = {
                            "from_stop_id": o.stop_id,
                            "from_stop_name": o.stop.name,
                            "to_stop_id": d.stop_id,
                            "to_stop_name": d.stop.name,
                            "distance_km": dist,
                            "unit_fare": pricing.unit_fare_for(route.fare_rule, dist),
                        }
                    return True, seg
        return False, None
    if origin:
        return any(_matches(s, origin) for s in stops), None
    if destination:
        return any(_matches(s, destination) for s in stops), None
    return True, None


@router.get("/routes", response_model=RouteListOut)
def list_routes(
    origin: str | None = Query(default=None, max_length=80),
    destination: str | None = Query(default=None, max_length=80),
    q: str | None = Query(default=None, max_length=80),
    sort: Literal["name", "fare", "distance", "frequency"] = "name",
    max_fare: Decimal | None = Query(default=None, ge=0),
    max_frequency: int | None = Query(default=None, ge=1, le=240, description="Max minutes between buses"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    routes = db.scalars(_load_routes_stmt().where(Route.is_active.is_(True))).all()
    results: list[tuple[Route, dict | None]] = []
    for r in routes:
        if q and q.lower() not in r.name.lower() and q.lower() not in r.code.lower():
            continue
        ok, seg = _segment(r, origin, destination)
        if not ok:
            continue
        if max_frequency and r.frequency_minutes > max_frequency:
            continue
        if max_fare is not None:
            fare_val = seg["unit_fare"] if seg else (r.fare_rule.min_fare if r.fare_rule else None)
            if fare_val is None or fare_val > max_fare:
                continue
        results.append((r, seg))

    def key(item):
        r, seg = item
        if sort == "fare":
            return seg["unit_fare"] if seg else (r.fare_rule.min_fare if r.fare_rule else Decimal("1e9"))
        if sort == "distance":
            return seg["distance_km"] if seg else (r.route_stops[-1].distance_km if r.route_stops else 0)
        if sort == "frequency":
            return r.frequency_minutes
        return r.name.lower()

    results.sort(key=key)
    total = len(results)
    page = results[offset : offset + limit]
    return {"items": [route_out(r, s) for r, s in page], "total": total}


@router.get("/routes/{route_id}", response_model=RouteOut)
def get_route(route_id: int, db: Session = Depends(get_db)):
    route = db.scalar(_load_routes_stmt().where(Route.id == route_id, Route.is_active.is_(True)))
    if route is None:
        raise NotFoundError("Route not found")
    return route_out(route)


@router.get("/routes/{route_id}/departures", response_model=DeparturesOut)
def departures(route_id: int, date_: date = Query(alias="date"), db: Session = Depends(get_db)):
    route = db.get(Route, route_id)
    if route is None or not route.is_active:
        raise NotFoundError("Route not found")
    times = booking_service.departure_times(route)
    now = now_local()
    if date_ < now.date():
        times = []
    elif date_ == now.date():
        cutoff = now + timedelta(minutes=booking_service.MIN_LEAD_MINUTES)
        times = [t for t in times if booking_service.departure_dt(date_, t) >= cutoff]
    return {"date": date_, "times": times}


@router.get("/stops", response_model=list[StopOut])
def list_stops(q: str | None = Query(default=None, max_length=80), db: Session = Depends(get_db)):
    stmt = select(Stop).order_by(Stop.name).limit(200)
    if q:
        stmt = select(Stop).where(Stop.name.ilike(f"%{q}%")).order_by(Stop.name).limit(200)
    return db.scalars(stmt).all()


@router.get("/fare-quote", response_model=FareQuoteOut)
def fare_quote(
    route_id: int,
    from_stop_id: int,
    to_stop_id: int,
    passengers: int = Query(default=1, ge=1, le=6),
    db: Session = Depends(get_db),
):
    q = pricing.quote(db, route_id, from_stop_id, to_stop_id, passengers)
    return {
        "route_id": route_id,
        "from_stop_id": from_stop_id,
        "to_stop_id": to_stop_id,
        "passengers": passengers,
        "distance_km": q.distance_km,
        "unit_fare": q.unit_fare,
        "total_fare": q.total,
        "currency": get_settings().currency,
    }


@router.get("/pass-types", response_model=list[PassTypeOut])
def pass_types(db: Session = Depends(get_db)):
    return db.scalars(select(PassType).where(PassType.is_active.is_(True)).order_by(PassType.duration_days, PassType.name)).all()
