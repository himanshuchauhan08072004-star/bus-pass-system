from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.core.rate_limit import client_ip
from app.core.timeutil import today_local, utcnow
from app.models import (
    AuditLog,
    Booking,
    Bus,
    BusPass,
    FareRule,
    PassApplication,
    PassType,
    Payment,
    Route,
    RouteStop,
    Stop,
    User,
)
from app.schemas.schemas import (
    AuditLogOut,
    BusIn,
    BusOut,
    CancelIn,
    FareRuleIn,
    PassTypeIn,
    PassTypeOut,
    ReviewIn,
    RouteIn,
    RouteOut,
    RouteStopsIn,
    StopIn,
    StopOut,
    UserAdminUpdateIn,
    UserOut,
)
from app.services import bookings as booking_service
from app.services import passes as pass_service
from app.services.audit import log_action
from app.services.serializers import application_out, booking_out, payment_out, route_out

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _commit(db: Session, conflict_msg: str) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError(conflict_msg)


def _page(db: Session, stmt, serialize, limit: int, offset: int) -> dict:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.limit(limit).offset(offset)).all()
    return {"items": [serialize(r) for r in rows], "total": total}


def _route_stmt():
    return select(Route).options(selectinload(Route.route_stops).selectinload(RouteStop.stop), selectinload(Route.fare_rule))


def _get_route(db: Session, route_id: int) -> Route:
    r = db.scalar(_route_stmt().where(Route.id == route_id))
    if r is None:
        raise NotFoundError("Route not found")
    return r


# ---------------- stats ----------------
@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    today = today_local()
    passengers = db.scalar(select(func.count()).select_from(User).where(User.role == "passenger")) or 0
    active_passes = db.scalar(
        select(func.count()).select_from(BusPass).where(BusPass.status == "active", BusPass.valid_from <= today, BusPass.valid_to >= today)
    ) or 0
    pending_apps = db.scalar(select(func.count()).select_from(PassApplication).where(PassApplication.status == "pending")) or 0
    by_status = dict(db.execute(select(Booking.status, func.count()).group_by(Booking.status)).all())
    revenue = db.scalar(
        select(func.coalesce(func.sum(Payment.amount - Payment.refunded_amount), 0)).where(
            Payment.status.in_(("succeeded", "partially_refunded", "refunded"))
        )
    )
    since = utcnow() - timedelta(days=7)
    last7 = db.scalar(select(func.count()).select_from(Booking).where(Booking.created_at >= since)) or 0
    per_route = db.execute(
        select(Route.code, Route.name, func.count(Booking.id))
        .join(Booking, Booking.route_id == Route.id)
        .where(Booking.status == "confirmed")
        .group_by(Route.id, Route.code, Route.name)
        .order_by(func.count(Booking.id).desc())
        .limit(5)
    ).all()
    recent = db.scalars(select(AuditLog).options(selectinload(AuditLog.actor)).order_by(AuditLog.id.desc()).limit(10)).all()
    return {
        "total_passengers": passengers,
        "active_passes": active_passes,
        "pending_applications": pending_apps,
        "bookings_by_status": {s: by_status.get(s, 0) for s in ("pending_payment", "confirmed", "cancelled", "expired")},
        "bookings_last_7_days": last7,
        "net_revenue": str(Decimal(revenue or 0).quantize(Decimal("0.01"))),
        "routes": db.scalar(select(func.count()).select_from(Route)) or 0,
        "buses": db.scalar(select(func.count()).select_from(Bus)) or 0,
        "top_routes": [{"code": c, "name": n, "bookings": k} for c, n, k in per_route],
        "recent_activity": [_audit_out(a) for a in recent],
    }


def _audit_out(a: AuditLog) -> dict:
    return {
        "id": a.id,
        "actor_id": a.actor_id,
        "actor_email": a.actor.email if a.actor else None,
        "action": a.action,
        "entity_type": a.entity_type,
        "entity_id": a.entity_id,
        "details": a.details,
        "ip": a.ip,
        "created_at": a.created_at,
    }


@router.get("/audit-logs")
def audit_logs(
    action: str | None = Query(default=None, max_length=60),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(AuditLog).options(selectinload(AuditLog.actor)).order_by(AuditLog.id.desc())
    if action:
        stmt = stmt.where(AuditLog.action.like(f"{action}%"))
    return _page(db, stmt, _audit_out, limit, offset)


# ---------------- stops ----------------
@router.get("/stops")
def list_stops(q: str | None = None, limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    stmt = select(Stop).order_by(Stop.name)
    if q:
        stmt = stmt.where(Stop.name.ilike(f"%{q}%"))
    return _page(db, stmt, lambda s: StopOut.model_validate(s).model_dump(), limit, offset)


@router.post("/stops", response_model=StopOut, status_code=201)
def create_stop(body: StopIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    s = Stop(name=body.name, city=body.city)
    db.add(s)
    db.flush()
    log_action(db, admin, "admin.stop.create", "stop", s.id, {"name": s.name}, client_ip(request))
    _commit(db, "A stop with this name already exists")
    return s


@router.put("/stops/{stop_id}", response_model=StopOut)
def update_stop(stop_id: int, body: StopIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    s = db.get(Stop, stop_id)
    if s is None:
        raise NotFoundError("Stop not found")
    s.name, s.city = body.name, body.city
    log_action(db, admin, "admin.stop.update", "stop", s.id, {"name": s.name}, client_ip(request))
    _commit(db, "A stop with this name already exists")
    return s


@router.delete("/stops/{stop_id}", status_code=204)
def delete_stop(stop_id: int, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    s = db.get(Stop, stop_id)
    if s is None:
        raise NotFoundError("Stop not found")
    log_action(db, admin, "admin.stop.delete", "stop", s.id, {"name": s.name}, client_ip(request))
    db.delete(s)
    _commit(db, "Stop is used by a route or booking and cannot be deleted")


# ---------------- buses ----------------
def _check_bus_route(db: Session, route_id: int | None) -> None:
    if route_id is not None and db.get(Route, route_id) is None:
        raise UnprocessableError("Route does not exist")


@router.get("/buses")
def list_buses(limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    return _page(db, select(Bus).order_by(Bus.registration_number), lambda b: BusOut.model_validate(b).model_dump(), limit, offset)


@router.post("/buses", response_model=BusOut, status_code=201)
def create_bus(body: BusIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    _check_bus_route(db, body.route_id)
    bus = Bus(**body.model_dump())
    bus.registration_number = bus.registration_number.upper()
    db.add(bus)
    db.flush()
    log_action(db, admin, "admin.bus.create", "bus", bus.id, {"registration": bus.registration_number}, client_ip(request))
    _commit(db, "A bus with this registration number already exists")
    return bus


@router.put("/buses/{bus_id}", response_model=BusOut)
def update_bus(bus_id: int, body: BusIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    bus = db.get(Bus, bus_id)
    if bus is None:
        raise NotFoundError("Bus not found")
    _check_bus_route(db, body.route_id)
    for k, v in body.model_dump().items():
        setattr(bus, k, v)
    bus.registration_number = bus.registration_number.upper()
    log_action(db, admin, "admin.bus.update", "bus", bus.id, None, client_ip(request))
    _commit(db, "A bus with this registration number already exists")
    return bus


@router.delete("/buses/{bus_id}", status_code=204)
def delete_bus(bus_id: int, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    bus = db.get(Bus, bus_id)
    if bus is None:
        raise NotFoundError("Bus not found")
    log_action(db, admin, "admin.bus.delete", "bus", bus.id, {"registration": bus.registration_number}, client_ip(request))
    db.delete(bus)
    _commit(db, "Bus cannot be deleted")


# ---------------- routes / route stops / fares ----------------
@router.get("/routes")
def list_routes(q: str | None = None, limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    stmt = _route_stmt().order_by(Route.code)
    if q:
        stmt = stmt.where(or_(Route.name.ilike(f"%{q}%"), Route.code.ilike(f"%{q}%")))
    return _page(db, stmt, route_out, limit, offset)


@router.post("/routes", response_model=RouteOut, status_code=201)
def create_route(body: RouteIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = Route(**body.model_dump())
    r.code = r.code.upper()
    db.add(r)
    db.flush()
    log_action(db, admin, "admin.route.create", "route", r.id, {"code": r.code}, client_ip(request))
    _commit(db, "A route with this code already exists")
    return route_out(_get_route(db, r.id))


@router.put("/routes/{route_id}", response_model=RouteOut)
def update_route(route_id: int, body: RouteIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = _get_route(db, route_id)
    for k, v in body.model_dump().items():
        setattr(r, k, v)
    r.code = r.code.upper()
    log_action(db, admin, "admin.route.update", "route", r.id, {"is_active": r.is_active}, client_ip(request))
    _commit(db, "A route with this code already exists")
    return route_out(_get_route(db, route_id))


@router.put("/routes/{route_id}/stops", response_model=RouteOut)
def set_route_stops(route_id: int, body: RouteStopsIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = _get_route(db, route_id)
    ids = [s.stop_id for s in body.stops]
    found = set(db.scalars(select(Stop.id).where(Stop.id.in_(ids))).all())
    if found != set(ids):
        raise UnprocessableError("One or more stops do not exist")
    has_bookings = db.scalar(select(func.count()).select_from(Booking).where(Booking.route_id == r.id, Booking.status.in_(("pending_payment", "confirmed"))))
    if has_bookings:
        raise ConflictError("This route has live bookings; deactivate it or wait before changing its stops")
    r.route_stops.clear()
    db.flush()
    for i, s in enumerate(body.stops, start=1):
        r.route_stops.append(RouteStop(stop_id=s.stop_id, sequence=i, distance_km=s.distance_km))
    log_action(db, admin, "admin.route.stops", "route", r.id, {"stops": ids}, client_ip(request))
    _commit(db, "Could not save route stops")
    return route_out(_get_route(db, route_id))


@router.put("/routes/{route_id}/fare", response_model=RouteOut)
def set_fare(route_id: int, body: FareRuleIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = _get_route(db, route_id)
    if r.fare_rule is None:
        r.fare_rule = FareRule(**body.model_dump())
    else:
        for k, v in body.model_dump().items():
            setattr(r.fare_rule, k, v)
    log_action(db, admin, "admin.fare.update", "route", r.id, {k: str(v) for k, v in body.model_dump().items()}, client_ip(request))
    _commit(db, "Could not save fare rule")
    return route_out(_get_route(db, route_id))


@router.delete("/routes/{route_id}", status_code=204)
def delete_route(route_id: int, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = _get_route(db, route_id)
    log_action(db, admin, "admin.route.delete", "route", r.id, {"code": r.code}, client_ip(request))
    db.delete(r)
    _commit(db, "Route has bookings and cannot be deleted. Deactivate it instead.")


# ---------------- pass types ----------------
@router.get("/pass-types")
def list_pass_types(db: Session = Depends(get_db)):
    rows = db.scalars(select(PassType).order_by(PassType.duration_days, PassType.name)).all()
    return {"items": [PassTypeOut.model_validate(p).model_dump() for p in rows], "total": len(rows)}


@router.post("/pass-types", response_model=PassTypeOut, status_code=201)
def create_pass_type(body: PassTypeIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    p = PassType(**body.model_dump())
    db.add(p)
    db.flush()
    log_action(db, admin, "admin.passtype.create", "pass_type", p.id, {"name": p.name, "price": str(p.price)}, client_ip(request))
    _commit(db, "A pass type with this name already exists")
    return p


@router.put("/pass-types/{pt_id}", response_model=PassTypeOut)
def update_pass_type(pt_id: int, body: PassTypeIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    p = db.get(PassType, pt_id)
    if p is None:
        raise NotFoundError("Pass type not found")
    old_price = p.price
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    log_action(db, admin, "admin.passtype.update", "pass_type", p.id, {"old_price": str(old_price), "new_price": str(p.price)}, client_ip(request))
    _commit(db, "A pass type with this name already exists")
    return p


@router.delete("/pass-types/{pt_id}", status_code=204)
def delete_pass_type(pt_id: int, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    p = db.get(PassType, pt_id)
    if p is None:
        raise NotFoundError("Pass type not found")
    log_action(db, admin, "admin.passtype.delete", "pass_type", p.id, {"name": p.name}, client_ip(request))
    db.delete(p)
    _commit(db, "Pass type is in use. Deactivate it instead.")


# ---------------- pass applications ----------------
@router.get("/pass-applications")
def list_applications(
    status: str | None = Query(default=None, pattern="^(pending|approved|rejected)$"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(PassApplication).options(selectinload(PassApplication.user)).order_by(PassApplication.id.desc())
    if status:
        stmt = stmt.where(PassApplication.status == status)
    return _page(db, stmt, lambda a: application_out(a, admin=True), limit, offset)


def _get_application(db: Session, app_id: int) -> PassApplication:
    a = db.scalar(select(PassApplication).where(PassApplication.id == app_id).with_for_update())
    if a is None:
        raise NotFoundError("Application not found")
    return a


@router.post("/pass-applications/{app_id}/approve")
def approve_application(app_id: int, request: Request, body: ReviewIn | None = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    a = _get_application(db, app_id)
    p = pass_service.approve_application(db, a, admin, body.note if body else None)
    log_action(db, admin, "admin.pass.approve", "pass_application", a.id, {"pass_code": p.pass_code}, client_ip(request))
    _commit(db, "Could not approve application")
    return application_out(a, admin=True)


@router.post("/pass-applications/{app_id}/reject")
def reject_application(app_id: int, request: Request, body: ReviewIn | None = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    a = _get_application(db, app_id)
    pass_service.reject_application(db, a, admin, body.note if body else None)
    log_action(db, admin, "admin.pass.reject", "pass_application", a.id, {"note": (body.note if body else None)}, client_ip(request))
    _commit(db, "Could not reject application")
    return application_out(a, admin=True)


# ---------------- users ----------------
@router.get("/users")
def list_users(q: str | None = None, limit: int = Query(default=25, ge=1, le=100), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db)):
    stmt = select(User).order_by(User.id.desc())
    if q:
        stmt = stmt.where(or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%")))
    return _page(db, stmt, lambda u: UserOut.model_validate(u).model_dump(), limit, offset)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserAdminUpdateIn, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if u is None:
        raise NotFoundError("User not found")
    if u.id == admin.id:
        raise ConflictError("Administrators cannot change their own role or status")
    changes = {}
    if body.is_active is not None and body.is_active != u.is_active:
        u.is_active = body.is_active
        u.token_version += 1
        changes["is_active"] = body.is_active
    if body.role is not None and body.role != u.role:
        u.role = body.role
        u.token_version += 1
        changes["role"] = body.role
    if changes:
        log_action(db, admin, "admin.user.update", "user", u.id, changes, client_ip(request))
    db.commit()
    return u


# ---------------- bookings / payments ----------------
@router.get("/bookings")
def list_bookings(
    status: str | None = Query(default=None, pattern="^(pending_payment|confirmed|cancelled|expired)$"),
    q: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    booking_service.expire_stale_holds(db)
    db.commit()
    stmt = select(Booking).options(selectinload(Booking.user)).order_by(Booking.id.desc())
    if status:
        stmt = stmt.where(Booking.status == status)
    if q:
        stmt = stmt.where(Booking.reference.ilike(f"%{q}%"))
    return _page(db, stmt, lambda b: booking_out(b, admin=True), limit, offset)


@router.post("/bookings/{booking_id}/cancel")
def admin_cancel_booking(booking_id: int, request: Request, body: CancelIn | None = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    b = db.get(Booking, booking_id)
    if b is None:
        raise NotFoundError("Booking not found")
    booking_service.cancel_booking(db, b, by_admin=True, reason=body.reason if body else None)
    log_action(db, admin, "admin.booking.cancel", "booking", b.id, {"refund": str(b.refund_amount)}, client_ip(request))
    db.commit()
    return booking_out(b, detail=True, admin=True)


@router.get("/payments")
def list_payments(
    status: str | None = Query(default=None, pattern="^(pending|succeeded|failed|cancelled|refunded|partially_refunded)$"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(Payment).options(selectinload(Payment.user)).order_by(Payment.id.desc())
    if status:
        stmt = stmt.where(Payment.status == status)

    def ser(p: Payment) -> dict:
        d = payment_out(p)
        d["passenger_email"] = p.user.email
        d["target"] = "booking" if p.booking_id else "pass_application"
        return d

    return _page(db, stmt, ser, limit, offset)
