# Architecture

## Overview

```
Browser ──HTTPS──▶ Next.js (App Router, SSR/static)
                     │  /api/* same-origin proxy (route handler)
                     ▼
                  FastAPI (REST, stateless) ──▶ PostgreSQL
                     │
                     └──▶ Payment provider interface (simulated in dev)
```

- **Frontend (Next.js):** pages for the public site, passenger dashboard and administrator console. A catch-all route handler (`frontend/src/app/api/[...path]/route.ts`) proxies `/api/*` to the backend at runtime (`BACKEND_URL`). Keeping the API on the same origin lets the session cookie stay `SameSite=Lax` and `httpOnly` without CORS.
- **Backend (FastAPI):** stateless REST API. All business rules (pricing, booking, cancellation, payments, passes) live in `backend/app/services/`; routers in `backend/app/api/v1/` are thin.
- **Database (PostgreSQL):** the source of truth. Constraints enforce invariants the application also checks, so races cannot corrupt data.

## Backend layout

```
app/core/       config, security (Argon2id, JWT, QR signing), rate limit, deps (auth/CSRF/RBAC), errors, time
app/models/     SQLAlchemy models
app/schemas/    Pydantic request/response models
app/services/   pricing, bookings, passes, payments, audit, serializers
app/payments/   provider interface + simulated provider
app/api/v1/     auth, catalog, bookings(+payments), passes, dashboard, verify, admin, health
alembic/        migrations
```

## Key design decisions

**Server-side pricing.** `services/pricing.quote()` is the only place a fare is computed. Booking creation accepts route, stops, date, time and passenger count only; extra fields such as `total_fare` are ignored (covered by tests). Pass prices come from `pass_types.price` and are snapshotted onto the application.

**Payments.** `PaymentProvider` has `charge()`, `verify()` and `refund()`. `services/payments.pay()` locks the payment row (`SELECT … FOR UPDATE`), calls `charge()`, then `verify()`, and only marks the payment `succeeded` (and confirms the booking) if the provider verification says so. Already-succeeded payments return success without charging again. After 5 declined attempts the payment fails and the booking expires. The `simulate` field is accepted only by the simulated provider. To add a real gateway, implement the three methods; for hosted-checkout gateways, replace `charge()` with order creation and add a signed webhook endpoint that calls the same completion code. Raw card data never reaches this backend.

**Booking integrity.** A partial unique index `uq_bookings_user_slot_active (user_id, travel_date, departure_time) WHERE status IN ('pending_payment','confirmed')` makes duplicate and conflicting bookings impossible even with concurrent requests; the service checks first to return a friendly message and catches `IntegrityError` for the race. Unpaid holds expire lazily (on the next list/create/pay) after `BOOKING_HOLD_MINUTES`.

**References and identifiers.** Booking references are `TFB-` + 10 characters from a 31-letter unambiguous alphabet generated with `secrets` (cryptographically secure); pass codes are `TFP-…`; payment references `TFT-…`. All are unique-indexed. Internal numeric IDs are never used as ticket identifiers.

**QR tokens.** Format: `TF1.<B|P>.<public code>.<nonce>.<signature>` where the signature is the first 128 bits of HMAC-SHA256 over `kind|code|nonce` using `QR_SIGNING_KEY`. The token contains no name, email or user id. `POST /api/v1/verify` parses the token, checks the signature in constant time, then **looks the ticket up in the database** and checks the nonce, status, cancellation and date. A valid signature alone never means a valid ticket: a cancelled booking, an expired pass or a ticket for another day is reported invalid. Rotating `qr_nonce` on a row invalidates its old QR.

**Authentication and sessions.** Passwords hashed with Argon2id. Login sets an httpOnly `tf_session` JWT (HS256, 30 min) and a readable `tf_csrf` cookie. Every mutating request must send `X-CSRF-Token` equal to the `csrf` claim inside the signed session token. The user's role and active flag are re-read from the database on every request; the token's `ver` claim must match `users.token_version`, so password change, deactivation and role change revoke sessions immediately. Login runs a dummy hash for unknown emails so response time does not reveal which emails exist.

**Authorization.** Admin endpoints sit behind a router-level `require_admin` dependency. Passenger endpoints always filter by the authenticated user id, so another user's booking, pass or payment returns 404.

**Audit trail.** Important actions (registration, booking, payment, cancellation, pass review, every admin change) write an `audit_logs` row in the same transaction as the change.

**Time zone.** Departure times are local to `OPERATOR_TIMEZONE` (default Asia/Kolkata); timestamps are stored in UTC.

## Request flow: booking a ticket

1. Browser calls `GET /api/fare-quote` as the user edits the form → server returns the fare.
2. `POST /api/bookings` → server re-quotes, validates the timetable and booking window, rejects clashes, creates a `pending_payment` booking and a `pending` payment in one transaction.
3. `POST /api/payments/{id}/pay` → server charges, verifies, confirms the booking.
4. `GET /api/bookings/{id}` → returns the signed QR token for confirmed bookings only.
5. At boarding, `POST /api/verify` checks the QR against the database.

## Configuration

All configuration is via environment variables (`backend/.env.example`, `frontend/.env.example`). `Settings.assert_production_safe()` refuses to start in production with default keys, short keys, identical keys, insecure cookies, or simulated payments unless `ALLOW_SIMULATED_PAYMENTS_IN_PRODUCTION=true`.
