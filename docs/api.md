# API reference

Base URL (via the Next.js proxy): `/api/...`. Direct backend: `/api/v1/...`. Interactive OpenAPI docs are served at `http://localhost:8000/docs` in development (disabled in production).

## Conventions

- **Auth:** httpOnly cookie `tf_session` set by login/register. Browsers send it automatically.
- **CSRF:** every non-GET request from a signed-in user must send `X-CSRF-Token` with the value of the `tf_csrf` cookie (the web app does this automatically). Missing or wrong token → `403`.
- **Errors:** JSON `{"detail": "human readable message"}`; validation errors also include `errors: [{field, message}]`. Status codes: `400/422` invalid input, `401` not signed in, `402` payment declined, `403` forbidden or CSRF failure, `404` not found (also used for other users' resources), `409` conflict (duplicate, closed, too early/late), `429` rate limited (with `Retry-After`).
- **Money:** decimal strings with two places, e.g. `"78.40"`. Currency is `INR`.
- **Dates/times:** `YYYY-MM-DD` and `HH:MM[:SS]`, local to the operator time zone.
- **Pagination:** admin lists accept `limit` (default 25, max 100/200) and `offset`, and return `{"items": [...], "total": n}`.
- **Clients never choose prices or payment results.** Unknown request fields are ignored.

## Endpoints

| Method | Path | Access | CSRF header |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | no |
| POST | `/api/v1/auth/logout` | Public | no |
| POST | `/api/v1/auth/register` | Public | no |
| GET | `/api/v1/fare-quote` | Public | no |
| GET | `/api/v1/health` | Public | no |
| GET | `/api/v1/health/ready` | Public | no |
| GET | `/api/v1/pass-types` | Public | no |
| GET | `/api/v1/routes` | Public | no |
| GET | `/api/v1/routes/{route_id}` | Public | no |
| GET | `/api/v1/routes/{route_id}/departures` | Public | no |
| GET | `/api/v1/stops` | Public | no |
| POST | `/api/v1/verify` | Public | no |
| POST | `/api/v1/auth/change-password` | Signed-in | yes |
| GET | `/api/v1/auth/me` | Signed-in | no |
| PATCH | `/api/v1/auth/me` | Signed-in | yes |
| GET | `/api/v1/bookings` | Signed-in | no |
| POST | `/api/v1/bookings` | Signed-in | yes |
| GET | `/api/v1/bookings/{booking_id}` | Signed-in | no |
| POST | `/api/v1/bookings/{booking_id}/cancel` | Signed-in | yes |
| GET | `/api/v1/dashboard` | Signed-in | no |
| GET | `/api/v1/passes` | Signed-in | no |
| GET | `/api/v1/passes/applications` | Signed-in | no |
| POST | `/api/v1/passes/applications` | Signed-in | yes |
| GET | `/api/v1/passes/{pass_id}` | Signed-in | no |
| POST | `/api/v1/passes/{pass_id}/renew` | Signed-in | yes |
| GET | `/api/v1/payments` | Signed-in | no |
| POST | `/api/v1/payments/{payment_id}/pay` | Signed-in | yes |
| GET | `/api/v1/admin/audit-logs` | Admin | no |
| GET | `/api/v1/admin/bookings` | Admin | no |
| POST | `/api/v1/admin/bookings/{booking_id}/cancel` | Admin | yes |
| GET | `/api/v1/admin/buses` | Admin | no |
| POST | `/api/v1/admin/buses` | Admin | yes |
| DELETE | `/api/v1/admin/buses/{bus_id}` | Admin | yes |
| PUT | `/api/v1/admin/buses/{bus_id}` | Admin | yes |
| GET | `/api/v1/admin/pass-applications` | Admin | no |
| POST | `/api/v1/admin/pass-applications/{app_id}/approve` | Admin | yes |
| POST | `/api/v1/admin/pass-applications/{app_id}/reject` | Admin | yes |
| GET | `/api/v1/admin/pass-types` | Admin | no |
| POST | `/api/v1/admin/pass-types` | Admin | yes |
| DELETE | `/api/v1/admin/pass-types/{pt_id}` | Admin | yes |
| PUT | `/api/v1/admin/pass-types/{pt_id}` | Admin | yes |
| GET | `/api/v1/admin/payments` | Admin | no |
| GET | `/api/v1/admin/routes` | Admin | no |
| POST | `/api/v1/admin/routes` | Admin | yes |
| DELETE | `/api/v1/admin/routes/{route_id}` | Admin | yes |
| PUT | `/api/v1/admin/routes/{route_id}` | Admin | yes |
| PUT | `/api/v1/admin/routes/{route_id}/fare` | Admin | yes |
| PUT | `/api/v1/admin/routes/{route_id}/stops` | Admin | yes |
| GET | `/api/v1/admin/stats` | Admin | no |
| GET | `/api/v1/admin/stops` | Admin | no |
| POST | `/api/v1/admin/stops` | Admin | yes |
| DELETE | `/api/v1/admin/stops/{stop_id}` | Admin | yes |
| PUT | `/api/v1/admin/stops/{stop_id}` | Admin | yes |
| GET | `/api/v1/admin/users` | Admin | no |
| PATCH | `/api/v1/admin/users/{user_id}` | Admin | yes |

## Notable endpoints

### Search routes — `GET /routes`
Query: `origin`, `destination` (partial stop or city name; direction matters), `q`, `sort` (`name|fare|distance|frequency`), `max_fare`, `max_frequency`, `limit`, `offset`. When both origin and destination are given each result includes a `segment` with the server-computed `unit_fare`.

### Fare quote — `GET /fare-quote?route_id&from_stop_id&to_stop_id&passengers`
Returns `unit_fare`, `total_fare`, `distance_km`. This is the same function the booking uses.

### Create booking — `POST /bookings`
```json
{"route_id": 1, "from_stop_id": 1, "to_stop_id": 7, "travel_date": "2026-10-22", "departure_time": "10:00", "passengers": 2}
```
Returns the booking in `pending_payment` with a `payment` to pay within 15 minutes. `409` if the user already has a live booking at that date and time.

### Pay — `POST /payments/{id}/pay`
Body `{"simulate": "success" | "failure"}` (simulated provider only). `200` with the payment when the provider verified it; `402` when declined. Idempotent once succeeded.

### Cancel — `POST /bookings/{id}/cancel`
Applies the cancellation policy (≥24 h: 100%, 2–24 h: 50%, <2 h: `409`). The booking detail includes a `cancellation` preview.

### Passes
`POST /passes/applications {pass_type_id, declaration?}` → pay → admin approves. `POST /passes/{id}/renew` (within 7 days of expiry or after). Application `status` is one of `pending`, `active`, `upcoming`, `expired`, `rejected`.

### Verify — `POST /verify`
`{"token": "TF1.B.TFB-XXXXXXXXXX.<nonce>.<sig>"}` → `{valid, kind, status, reason, summary}`. Public and rate limited. Returns no personal data.

### Health
`GET /health` (liveness, also at `/api/v1/health`) and `GET /health/ready` (checks the database; `503` if unreachable).
