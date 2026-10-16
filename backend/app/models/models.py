from __future__ import annotations

import datetime as dt
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.timeutil import utcnow

MONEY = Numeric(10, 2)

USER_ROLES = ("passenger", "admin")
BUS_STATUSES = ("active", "maintenance", "retired")
ELIGIBILITY = ("general", "student", "senior")
APPLICATION_STATUSES = ("pending", "approved", "rejected")
PASS_STATUSES = ("active", "revoked")
BOOKING_STATUSES = ("pending_payment", "confirmed", "cancelled", "expired")
ACTIVE_BOOKING_STATUSES = ("pending_payment", "confirmed")
PAYMENT_STATUSES = ("pending", "succeeded", "failed", "cancelled", "refunded", "partially_refunded")


def _in(col: str, values: tuple[str, ...]) -> str:
    return f"{col} IN ({', '.join(repr(v) for v in values)})"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint(_in("role", USER_ROLES), name="ck_users_role"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="passenger", server_default="passenger")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, server_default=func.now()
    )


class Stop(Base):
    __tablename__ = "stops"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    city: Mapped[str] = mapped_column(String(80), default="", server_default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())


class Route(Base):
    __tablename__ = "routes"
    __table_args__ = (
        CheckConstraint("frequency_minutes > 0 AND frequency_minutes <= 240", name="ck_routes_frequency"),
        CheckConstraint("operating_end > operating_start", name="ck_routes_hours"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    operating_start: Mapped[dt.time] = mapped_column(Time)
    operating_end: Mapped[dt.time] = mapped_column(Time)
    frequency_minutes: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())

    route_stops: Mapped[list[RouteStop]] = relationship(
        back_populates="route", order_by="RouteStop.sequence", cascade="all, delete-orphan"
    )
    fare_rule: Mapped[FareRule | None] = relationship(back_populates="route", uselist=False, cascade="all, delete-orphan")
    buses: Mapped[list[Bus]] = relationship(back_populates="route")


class RouteStop(Base):
    __tablename__ = "route_stops"
    __table_args__ = (
        UniqueConstraint("route_id", "sequence", name="uq_route_stops_route_sequence"),
        UniqueConstraint("route_id", "stop_id", name="uq_route_stops_route_stop"),
        CheckConstraint("sequence >= 1", name="ck_route_stops_sequence"),
        CheckConstraint("distance_km >= 0", name="ck_route_stops_distance"),
        Index("ix_route_stops_stop_id", "stop_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id", ondelete="CASCADE"))
    stop_id: Mapped[int] = mapped_column(ForeignKey("stops.id", ondelete="RESTRICT"))
    sequence: Mapped[int] = mapped_column(Integer)
    distance_km: Mapped[Decimal] = mapped_column(Numeric(8, 2))  # cumulative from first stop

    route: Mapped[Route] = relationship(back_populates="route_stops")
    stop: Mapped[Stop] = relationship()


class FareRule(Base):
    __tablename__ = "fare_rules"
    __table_args__ = (
        CheckConstraint("base_fare >= 0 AND per_km_rate >= 0 AND min_fare >= 0", name="ck_fare_rules_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id", ondelete="CASCADE"), unique=True)
    base_fare: Mapped[Decimal] = mapped_column(MONEY)
    per_km_rate: Mapped[Decimal] = mapped_column(MONEY)
    min_fare: Mapped[Decimal] = mapped_column(MONEY)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, server_default=func.now()
    )

    route: Mapped[Route] = relationship(back_populates="fare_rule")


class Bus(Base):
    __tablename__ = "buses"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="ck_buses_capacity"),
        CheckConstraint(_in("status", BUS_STATUSES), name="ck_buses_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    registration_number: Mapped[str] = mapped_column(String(20), unique=True)
    capacity: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())

    route: Mapped[Route | None] = relationship(back_populates="buses")


class PassType(Base):
    __tablename__ = "pass_types"
    __table_args__ = (
        CheckConstraint("duration_days > 0", name="ck_pass_types_duration"),
        CheckConstraint("price >= 0", name="ck_pass_types_price"),
        CheckConstraint(_in("eligibility", ELIGIBILITY), name="ck_pass_types_eligibility"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    duration_days: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(MONEY)
    eligibility: Mapped[str] = mapped_column(String(20), default="general", server_default="general")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())


class BusPass(Base):
    __tablename__ = "bus_passes"
    __table_args__ = (
        CheckConstraint("valid_to >= valid_from", name="ck_bus_passes_dates"),
        CheckConstraint(_in("status", PASS_STATUSES), name="ck_bus_passes_status"),
        Index("ix_bus_passes_user_valid", "user_id", "valid_to"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    pass_code: Mapped[str] = mapped_column(String(20), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    pass_type_id: Mapped[int] = mapped_column(ForeignKey("pass_types.id", ondelete="RESTRICT"))
    valid_from: Mapped[dt.date] = mapped_column(Date)
    valid_to: Mapped[dt.date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")
    qr_nonce: Mapped[str] = mapped_column(String(24))
    renewed_from_id: Mapped[int | None] = mapped_column(ForeignKey("bus_passes.id", ondelete="SET NULL"))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())

    user: Mapped[User] = relationship()
    pass_type: Mapped[PassType] = relationship()


class PassApplication(Base):
    __tablename__ = "pass_applications"
    __table_args__ = (
        CheckConstraint(_in("status", APPLICATION_STATUSES), name="ck_pass_applications_status"),
        CheckConstraint("price >= 0", name="ck_pass_applications_price"),
        # At most one pending application per user and pass type.
        Index(
            "uq_pass_applications_pending",
            "user_id",
            "pass_type_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
            sqlite_where=text("status = 'pending'"),
        ),
        Index("ix_pass_applications_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    pass_type_id: Mapped[int] = mapped_column(ForeignKey("pass_types.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")
    price: Mapped[Decimal] = mapped_column(MONEY)  # snapshot of server-side price at application time
    declaration: Mapped[str | None] = mapped_column(Text)
    is_renewal: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    renews_pass_id: Mapped[int | None] = mapped_column(ForeignKey("bus_passes.id", ondelete="SET NULL"))
    pass_id: Mapped[int | None] = mapped_column(ForeignKey("bus_passes.id", ondelete="SET NULL"))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    review_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    pass_type: Mapped[PassType] = relationship()
    issued_pass: Mapped[BusPass | None] = relationship(foreign_keys=[pass_id])
    renews_pass: Mapped[BusPass | None] = relationship(foreign_keys=[renews_pass_id])
    payment: Mapped[Payment | None] = relationship(back_populates="application", uselist=False)


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("passengers >= 1 AND passengers <= 6", name="ck_bookings_passengers"),
        CheckConstraint("unit_fare >= 0 AND total_fare >= 0", name="ck_bookings_fare"),
        CheckConstraint(_in("status", BOOKING_STATUSES), name="ck_bookings_status"),
        # A user cannot hold two live bookings for the same departure slot
        # (covers exact duplicates and time conflicts, race-safe).
        Index(
            "uq_bookings_user_slot_active",
            "user_id",
            "travel_date",
            "departure_time",
            unique=True,
            postgresql_where=text("status IN ('pending_payment', 'confirmed')"),
            sqlite_where=text("status IN ('pending_payment', 'confirmed')"),
        ),
        Index("ix_bookings_user_created", "user_id", "created_at"),
        Index("ix_bookings_route_date", "route_id", "travel_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(20), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id", ondelete="RESTRICT"))
    from_stop_id: Mapped[int] = mapped_column(ForeignKey("stops.id", ondelete="RESTRICT"))
    to_stop_id: Mapped[int] = mapped_column(ForeignKey("stops.id", ondelete="RESTRICT"))
    travel_date: Mapped[dt.date] = mapped_column(Date)
    departure_time: Mapped[dt.time] = mapped_column(Time)
    passengers: Mapped[int] = mapped_column(Integer, default=1)
    unit_fare: Mapped[Decimal] = mapped_column(MONEY)
    total_fare: Mapped[Decimal] = mapped_column(MONEY)
    status: Mapped[str] = mapped_column(String(20), default="pending_payment", server_default="pending_payment")
    qr_nonce: Mapped[str] = mapped_column(String(24))
    hold_expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[str | None] = mapped_column(String(200))
    refund_amount: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0.00"), server_default="0")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())

    user: Mapped[User] = relationship()
    route: Mapped[Route] = relationship()
    from_stop: Mapped[Stop] = relationship(foreign_keys=[from_stop_id])
    to_stop: Mapped[Stop] = relationship(foreign_keys=[to_stop_id])
    payment: Mapped[Payment | None] = relationship(back_populates="booking", uselist=False)


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(_in("status", PAYMENT_STATUSES), name="ck_payments_status"),
        CheckConstraint("amount >= 0 AND refunded_amount >= 0 AND refunded_amount <= amount", name="ck_payments_amounts"),
        CheckConstraint(
            "(booking_id IS NOT NULL AND application_id IS NULL) OR (booking_id IS NULL AND application_id IS NOT NULL)",
            name="ck_payments_single_target",
        ),
        Index("ix_payments_user_created", "user_id", "created_at"),
        Index("ix_payments_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(20), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id", ondelete="RESTRICT"), unique=True)
    application_id: Mapped[int | None] = mapped_column(
        ForeignKey("pass_applications.id", ondelete="RESTRICT"), unique=True
    )
    amount: Mapped[Decimal] = mapped_column(MONEY)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    status: Mapped[str] = mapped_column(String(24), default="pending", server_default="pending")
    provider: Mapped[str] = mapped_column(String(30), default="simulated")
    provider_ref: Mapped[str | None] = mapped_column(String(64), unique=True)  # transaction reference
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    failure_reason: Mapped[str | None] = mapped_column(String(200))
    refunded_amount: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0.00"), server_default="0")
    refund_ref: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())
    paid_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()
    booking: Mapped[Booking | None] = relationship(back_populates="payment")
    application: Mapped[PassApplication | None] = relationship(back_populates="payment")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_created", "created_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(40))
    details: Mapped[dict | None] = mapped_column(JSON)
    ip: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())

    actor: Mapped[User | None] = relationship()
