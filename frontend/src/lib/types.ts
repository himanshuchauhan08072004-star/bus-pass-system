export type Role = "passenger" | "admin";

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface RouteStop {
  stop_id: number;
  stop_name: string;
  city: string;
  sequence: number;
  distance_km: string;
}
export interface FareRule {
  base_fare: string;
  per_km_rate: string;
  min_fare: string;
}
export interface Segment {
  from_stop_id: number;
  from_stop_name: string;
  to_stop_id: number;
  to_stop_name: string;
  distance_km: string;
  unit_fare: string;
}
export interface Route {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  operating_start: string;
  operating_end: string;
  frequency_minutes: number;
  total_distance_km: string;
  stops: RouteStop[];
  fare: FareRule | null;
  segment: Segment | null;
}
export interface Stop {
  id: number;
  name: string;
  city: string;
}
export interface FareQuote {
  route_id: number;
  from_stop_id: number;
  to_stop_id: number;
  passengers: number;
  distance_km: string;
  unit_fare: string;
  total_fare: string;
  currency: string;
}
export interface PassType {
  id: number;
  name: string;
  description: string;
  duration_days: number;
  price: string;
  eligibility: "general" | "student" | "senior";
  is_active: boolean;
}

export interface Payment {
  id: number;
  reference: string;
  amount: string;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "cancelled" | "refunded" | "partially_refunded";
  provider: string;
  transaction_ref: string | null;
  refunded_amount: string;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
  passenger_email?: string;
  target?: string;
}
export interface CancellationPreview {
  allowed: boolean;
  refund_percent: number;
  refund_amount: string;
  message: string;
}
export type BookingStatus = "pending_payment" | "confirmed" | "cancelled" | "expired";
export interface Booking {
  id: number;
  reference: string;
  status: BookingStatus;
  route_id: number;
  route_code: string;
  route_name: string;
  from_stop_id: number;
  from_stop_name: string;
  to_stop_id: number;
  to_stop_name: string;
  travel_date: string;
  departure_time: string;
  passengers: number;
  unit_fare: string;
  total_fare: string;
  hold_expires_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  refund_amount: string;
  created_at: string;
  payment: Payment | null;
  qr_token: string | null;
  cancellation: CancellationPreview | null;
  passenger_name: string | null;
  passenger_email: string | null;
}
export interface BusPass {
  id: number;
  pass_code: string;
  pass_type_id: number;
  pass_type_name: string;
  eligibility: string;
  status: "active" | "upcoming" | "expired" | "revoked";
  valid_from: string;
  valid_to: string;
  days_left: number;
  can_renew: boolean;
  qr_token: string | null;
  created_at: string;
}
export interface Application {
  id: number;
  pass_type_id: number;
  pass_type_name: string;
  status: "pending" | "active" | "upcoming" | "expired" | "rejected";
  raw_status: "pending" | "approved" | "rejected";
  price: string;
  is_renewal: boolean;
  declaration: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  pass_id: number | null;
  payment: Payment | null;
  passenger_name: string | null;
  passenger_email: string | null;
}
export interface Dashboard {
  active_pass: BusPass | null;
  reminders: string[];
  upcoming_journeys: Booking[];
  recent_bookings: Booking[];
  stats: { confirmed_trips: number; upcoming_trips: number; pending_applications: number; net_spent: string };
}
export interface VerifyResult {
  valid: boolean;
  kind?: "booking" | "pass" | null;
  status?: string | null;
  reason?: string | null;
  code?: string | null;
  summary?: Record<string, string | number> | null;
}
export interface Bus {
  id: number;
  registration_number: string;
  capacity: number;
  status: "active" | "maintenance" | "retired";
  route_id: number | null;
}
export interface AuditLog {
  id: number;
  actor_id: number | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}
export interface Paged<T> {
  items: T[];
  total: number;
}
export interface AdminStats {
  total_passengers: number;
  active_passes: number;
  pending_applications: number;
  bookings_by_status: Record<BookingStatus, number>;
  bookings_last_7_days: number;
  net_revenue: string;
  routes: number;
  buses: number;
  top_routes: { code: string; name: string; bookings: number }[];
  recent_activity: AuditLog[];
}
