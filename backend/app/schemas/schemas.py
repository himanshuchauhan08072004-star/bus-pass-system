import datetime as dt
import re
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, field_validator

# Decimals are serialised as fixed 2-decimal strings, e.g. "78.40".
Money = Annotated[Decimal, PlainSerializer(lambda v: f"{Decimal(v):.2f}", return_type=str, when_used="json")]

PHONE_RE = re.compile(r"^\+?[0-9][0-9\- ]{6,18}$")


def _check_password(v: str) -> str:
    if len(v) < 10 or len(v) > 128:
        raise ValueError("Password must be 10 to 128 characters")
    if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("Password must contain at least one letter and one digit")
    return v


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


# ---------- auth / profile ----------
class RegisterIn(Schema):
    email: EmailStr
    password: str
    full_name: str = Field(min_length=2, max_length=120)
    phone: str | None = None

    _pw = field_validator("password")(_check_password)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        if v in (None, ""):
            return None
        if not PHONE_RE.match(v):
            raise ValueError("Enter a valid phone number")
        return v


class LoginIn(Schema):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(Schema):
    id: int
    email: EmailStr
    full_name: str
    phone: str | None
    role: str
    is_active: bool
    created_at: dt.datetime


class ProfileUpdateIn(Schema):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        if v in (None, ""):
            return None
        if not PHONE_RE.match(v):
            raise ValueError("Enter a valid phone number")
        return v


class ChangePasswordIn(Schema):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str

    _pw = field_validator("new_password")(_check_password)


class MessageOut(Schema):
    message: str


# ---------- catalog ----------
class StopOut(Schema):
    id: int
    name: str
    city: str


class RouteStopOut(Schema):
    stop_id: int
    stop_name: str
    city: str
    sequence: int
    distance_km: Money


class FareRuleOut(Schema):
    base_fare: Money
    per_km_rate: Money
    min_fare: Money


class SegmentOut(Schema):
    from_stop_id: int
    from_stop_name: str
    to_stop_id: int
    to_stop_name: str
    distance_km: Money
    unit_fare: Money


class RouteOut(Schema):
    id: int
    code: str
    name: str
    is_active: bool
    operating_start: dt.time
    operating_end: dt.time
    frequency_minutes: int
    total_distance_km: Money
    stops: list[RouteStopOut]
    fare: FareRuleOut | None
    segment: SegmentOut | None = None


class RouteListOut(Schema):
    items: list[RouteOut]
    total: int


class FareQuoteOut(Schema):
    route_id: int
    from_stop_id: int
    to_stop_id: int
    passengers: int
    distance_km: Money
    unit_fare: Money
    total_fare: Money
    currency: str


class DeparturesOut(Schema):
    date: dt.date
    times: list[dt.time]


class PassTypeOut(Schema):
    id: int
    name: str
    description: str
    duration_days: int
    price: Money
    eligibility: str
    is_active: bool


# ---------- bookings / payments ----------
class BookingCreateIn(Schema):
    route_id: int
    from_stop_id: int
    to_stop_id: int
    travel_date: dt.date
    departure_time: dt.time
    passengers: int = Field(default=1, ge=1, le=6)


class CancelIn(Schema):
    reason: str | None = Field(default=None, max_length=200)


class PaymentOut(Schema):
    id: int
    reference: str
    amount: Money
    currency: str
    status: str
    provider: str
    transaction_ref: str | None
    refunded_amount: Money
    failure_reason: str | None
    created_at: dt.datetime
    paid_at: dt.datetime | None


class CancellationPreviewOut(Schema):
    allowed: bool
    refund_percent: int
    refund_amount: Money
    message: str


class BookingOut(Schema):
    id: int
    reference: str
    status: str
    route_id: int
    route_code: str
    route_name: str
    from_stop_id: int
    from_stop_name: str
    to_stop_id: int
    to_stop_name: str
    travel_date: dt.date
    departure_time: dt.time
    passengers: int
    unit_fare: Money
    total_fare: Money
    hold_expires_at: dt.datetime | None
    cancelled_at: dt.datetime | None
    cancel_reason: str | None
    refund_amount: Money
    created_at: dt.datetime
    payment: PaymentOut | None
    qr_token: str | None = None
    cancellation: CancellationPreviewOut | None = None
    passenger_name: str | None = None
    passenger_email: str | None = None


class PayIn(Schema):
    # Only honoured by the simulated provider; ignored/rejected otherwise.
    simulate: Literal["success", "failure"] | None = None


# ---------- passes ----------
class PassApplyIn(Schema):
    pass_type_id: int
    declaration: str | None = Field(default=None, max_length=500)


class ApplicationOut(Schema):
    id: int
    pass_type_id: int
    pass_type_name: str
    status: str  # pending | active | expired | rejected | upcoming
    raw_status: str
    price: Money
    is_renewal: bool
    declaration: str | None
    review_note: str | None
    created_at: dt.datetime
    reviewed_at: dt.datetime | None
    pass_id: int | None
    payment: PaymentOut | None
    passenger_name: str | None = None
    passenger_email: str | None = None


class BusPassOut(Schema):
    id: int
    pass_code: str
    pass_type_id: int
    pass_type_name: str
    eligibility: str
    status: str
    valid_from: dt.date
    valid_to: dt.date
    days_left: int
    can_renew: bool
    qr_token: str | None
    created_at: dt.datetime


# ---------- verify ----------
class VerifyIn(Schema):
    token: str = Field(min_length=10, max_length=200)


class VerifyOut(Schema):
    valid: bool
    kind: str | None = None
    status: str | None = None
    reason: str | None = None
    code: str | None = None
    summary: dict | None = None


# ---------- dashboard ----------
class DashboardOut(Schema):
    active_pass: BusPassOut | None
    reminders: list[str]
    upcoming_journeys: list[BookingOut]
    recent_bookings: list[BookingOut]
    stats: dict


# ---------- admin ----------
class Page(Schema):
    items: list
    total: int


class StopIn(Schema):
    name: str = Field(min_length=2, max_length=120)
    city: str = Field(default="", max_length=80)


class BusIn(Schema):
    registration_number: str = Field(min_length=4, max_length=20)
    capacity: int = Field(gt=0, le=200)
    status: Literal["active", "maintenance", "retired"] = "active"
    route_id: int | None = None


class BusOut(Schema):
    id: int
    registration_number: str
    capacity: int
    status: str
    route_id: int | None


class RouteIn(Schema):
    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=2, max_length=120)
    operating_start: dt.time
    operating_end: dt.time
    frequency_minutes: int = Field(gt=0, le=240)
    is_active: bool = True

    @field_validator("operating_end")
    @classmethod
    def _hours(cls, v, info):
        start = info.data.get("operating_start")
        if start is not None and v <= start:
            raise ValueError("operating_end must be after operating_start")
        return v


class RouteStopIn(Schema):
    stop_id: int
    distance_km: Money = Field(ge=0, max_digits=8, decimal_places=2)


class RouteStopsIn(Schema):
    stops: list[RouteStopIn] = Field(min_length=2, max_length=60)

    @field_validator("stops")
    @classmethod
    def _order(cls, v):
        ids = [s.stop_id for s in v]
        if len(set(ids)) != len(ids):
            raise ValueError("A stop can appear only once per route")
        for a, b in zip(v, v[1:]):
            if b.distance_km <= a.distance_km:
                raise ValueError("Distances must strictly increase along the route")
        if v[0].distance_km != 0:
            raise ValueError("The first stop must be at distance 0")
        return v


class FareRuleIn(Schema):
    base_fare: Money = Field(ge=0, le=10000, max_digits=10, decimal_places=2)
    per_km_rate: Money = Field(ge=0, le=1000, max_digits=10, decimal_places=2)
    min_fare: Money = Field(ge=0, le=10000, max_digits=10, decimal_places=2)


class PassTypeIn(Schema):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=500)
    duration_days: int = Field(gt=0, le=800)
    price: Money = Field(ge=0, le=100000, max_digits=10, decimal_places=2)
    eligibility: Literal["general", "student", "senior"] = "general"
    is_active: bool = True


class ReviewIn(Schema):
    note: str | None = Field(default=None, max_length=500)


class UserAdminUpdateIn(Schema):
    is_active: bool | None = None
    role: Literal["passenger", "admin"] | None = None


class AuditLogOut(Schema):
    id: int
    actor_id: int | None
    actor_email: str | None
    action: str
    entity_type: str
    entity_id: str | None
    details: dict | None
    ip: str | None
    created_at: dt.datetime
