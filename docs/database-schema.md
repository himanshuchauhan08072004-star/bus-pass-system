# Database schema

PostgreSQL 16. Schema is managed by Alembic (`backend/alembic/versions/0001_initial_schema.py`, generated from the models and verified with `alembic upgrade head`, `downgrade base`, `upgrade head` and `alembic check` on PostgreSQL). Money columns are `NUMERIC(10,2)`. Enumerations are `VARCHAR` with `CHECK` constraints (easy to migrate).

## Relationships

```
users 1─∞ bookings ∞─1 routes 1─∞ route_stops ∞─1 stops
users 1─∞ pass_applications ∞─1 pass_types 1─∞ bus_passes ∞─1 users
routes 1─1 fare_rules          routes 1─∞ buses
bookings 1─1 payments          pass_applications 1─1 payments
pass_applications ─▶ bus_passes (pass_id, renews_pass_id)   bus_passes ─▶ bus_passes (renewed_from_id)
users 1─∞ audit_logs (actor_id, SET NULL on delete)
```

## Tables

| Table | Purpose and key constraints |
|---|---|
| `users` | email (unique, lower-cased), Argon2id `password_hash`, `role` ∈ passenger/admin, `is_active`, `token_version` (session revocation) |
| `stops` | unique `name`, `city` |
| `routes` | unique `code`; `CHECK frequency_minutes BETWEEN 1 AND 240`; `CHECK operating_end > operating_start`; `is_active` |
| `route_stops` | route + stop + `sequence` + cumulative `distance_km`; unique (route, sequence); unique (route, stop); `CHECK sequence >= 1`, `distance_km >= 0`; FK to stops is `RESTRICT` |
| `fare_rules` | one per route (unique `route_id`): `base_fare`, `per_km_rate`, `min_fare`, all `CHECK >= 0` |
| `buses` | unique `registration_number`, `capacity > 0`, status ∈ active/maintenance/retired, nullable `route_id` (`SET NULL`) |
| `pass_types` | unique `name`, `duration_days > 0`, `price >= 0`, eligibility ∈ general/student/senior, `is_active` |
| `pass_applications` | user, pass type, status ∈ pending/approved/rejected, price snapshot, declaration, renewal link, reviewer, note. **Partial unique index**: one `pending` application per (user, pass type) |
| `bus_passes` | unique `pass_code`, user, pass type, `valid_from`/`valid_to` (`CHECK valid_to >= valid_from`), status ∈ active/revoked, `qr_nonce`, `renewed_from_id` |
| `bookings` | unique `reference`; user, route, from/to stops, date, time, passengers (`CHECK 1..6`), `unit_fare`/`total_fare`, status ∈ pending_payment/confirmed/cancelled/expired, `qr_nonce`, `hold_expires_at`, cancellation fields, `refund_amount`. **Partial unique index** `uq_bookings_user_slot_active` on (user, travel_date, departure_time) where status is live |
| `payments` | unique `reference` and `provider_ref` (transaction reference); exactly one target (`CHECK` booking XOR application, each unique); `amount`, `refunded_amount` (`CHECK refunded <= amount`), status ∈ pending/succeeded/failed/cancelled/refunded/partially_refunded, attempts, failure reason. No card data columns exist |
| `audit_logs` | actor, action, entity type/id, JSON details, IP, timestamp |

## Indexes (beyond primary and unique keys)

`bookings(user_id, created_at)`, `bookings(route_id, travel_date)`, `bus_passes(user_id, valid_to)`, `pass_applications(status)`, `pass_applications(user_id)`, `payments(user_id, created_at)`, `payments(status)`, `route_stops(stop_id)`, `buses(route_id)`, `audit_logs(created_at)`, `audit_logs(entity_type, entity_id)`, `users(email)`.

## Referential integrity

Foreign keys reference users, routes, stops and pass types with `RESTRICT`, so history cannot be orphaned; routes with bookings cannot be deleted (administrators deactivate them). Route deletion cascades to its `route_stops` and `fare_rules` only. SQLite foreign keys are switched on in the test engine so tests exercise the same rules.

## Transactions

Each request commits once. Creating a booking inserts the booking and its payment together; paying locks the payment row; cancelling updates booking and payment together; approving a pass creates the pass and updates the application together; audit rows are written in the same transaction as the action they describe.

## Migrations

```powershell
cd backend
alembic upgrade head                                # apply
alembic revision --autogenerate -m "describe change" # after editing models
alembic check                                       # fails if models and migrations differ
```
