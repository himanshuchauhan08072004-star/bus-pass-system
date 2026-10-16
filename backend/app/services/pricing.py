from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.models import FareRule, Route, RouteStop

CENT = Decimal("0.01")


def money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def unit_fare_for(rule: FareRule, distance_km: Decimal) -> Decimal:
    raw = rule.base_fare + rule.per_km_rate * distance_km
    return money(max(rule.min_fare, raw))


@dataclass
class FareQuote:
    route: Route
    from_rs: RouteStop
    to_rs: RouteStop
    distance_km: Decimal
    unit_fare: Decimal
    passengers: int
    total: Decimal


def quote(db: Session, route_id: int, from_stop_id: int, to_stop_id: int, passengers: int) -> FareQuote:
    """The ONLY place a fare is computed. Clients never send a price."""
    if not 1 <= passengers <= 6:
        raise UnprocessableError("Passengers must be between 1 and 6")
    route = db.get(Route, route_id)
    if route is None or not route.is_active:
        raise NotFoundError("Route not found")
    if route.fare_rule is None:
        raise ConflictError("No fare is configured for this route yet")
    by_stop = {rs.stop_id: rs for rs in route.route_stops}
    from_rs, to_rs = by_stop.get(from_stop_id), by_stop.get(to_stop_id)
    if from_rs is None or to_rs is None:
        raise UnprocessableError("Selected stops do not belong to this route")
    if from_rs.sequence >= to_rs.sequence:
        raise UnprocessableError("Destination must come after the origin on this route")
    distance = Decimal(to_rs.distance_km) - Decimal(from_rs.distance_km)
    unit = unit_fare_for(route.fare_rule, distance)
    return FareQuote(route, from_rs, to_rs, distance, unit, passengers, money(unit * passengers))
