# Testing

## Verified results (run during development of this repository)

| Check | Result |
|---|---|
| Backend `pytest` on SQLite | **86 passed** |
| Backend `pytest` on PostgreSQL 16 (`TEST_DATABASE_URL`) | **86 passed** |
| Alembic `upgrade head` → `downgrade base` → `upgrade head` on PostgreSQL, `alembic check` | succeeded, no model drift |
| Frontend `npm test` (Vitest + Testing Library) | **25 passed** |
| `npm run lint`, `npm run typecheck`, `npm run build` | all clean; 19 routes built |
| End-to-end smoke test (real backend on PostgreSQL + real Next.js server, via the `/api` proxy, with cookies) | passed (see below) |

Smoke test covered: login through the proxy (httpOnly session cookie + CSRF cookie issued), route search, **403 on a POST without the CSRF header**, booking with a tampered `total_fare` (server total used), **402 on a declined payment**, successful payment and QR issue, QR verification (correctly reports a future-dated ticket as not valid today), **403 for a passenger on admin endpoints**, admin statistics, public and protected pages (protected pages redirect to login), and no errors in the backend log.

## Running the tests

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest                    # SQLite, zero setup
$env:TEST_DATABASE_URL = "postgresql+psycopg://transitflow:transitflow_dev@localhost:5432/transitflow_test"
pytest                    # PostgreSQL (create the transitflow_test database first; tests drop and recreate tables in it)

cd ..\frontend
npm test
npm run lint ; npm run typecheck ; npm run build
```

Tests reseed demonstration data for every test and use a fresh schema, so they never touch your development database unless `TEST_DATABASE_URL` points at it. Point it at a **separate** database.

## Backend coverage (`backend/tests/`)

| File | What it proves |
|---|---|
| `test_health.py` | liveness, readiness (DB), security headers |
| `test_auth.py` | Argon2id hashes; register/login/logout; cookie flags; weak and duplicate credentials rejected; generic login errors; protected endpoints; CSRF enforced; role comes from the DB; password change and deactivation revoke sessions |
| `test_catalog.py` | search by origin/destination, direction matters, no-result handling, sorting and filters, server-side fare maths and minimum fare, invalid stop pairs rejected, departures, public pass types |
| `test_bookings.py` | tampered price ignored; pay flow; idempotent payment; declined payment never confirms; client cannot mark paid; duplicate and clashing bookings blocked (even across routes); re-book after cancel; invalid departures rejected; ownership isolation; **cancellation policy at 24 h+, 2–24 h and <2 h**; hold expiry; history and dashboard |
| `test_passes.py` | server price, payment before approval, admin approve/reject with refund, concession declaration, duplicate/active-pass blocks, renewal window and auto-approval, expiry status without QR, ownership isolation |
| `test_verify.py` | valid/future/cancelled tickets, tampered and forged tokens, wrong nonce, pass verification and revocation, token round trip |
| `test_admin.py` | every admin endpoint is 401 for anonymous and 403 for passengers; stats; CRUD for stops, routes, route-stop sequences, fares, buses, pass types; constraints; audit entries; admin cancel refund; self-demotion blocked; role change audited |
| `test_security.py` | SQL-injection strings through all search/filter inputs, login rate limit (429 + `Retry-After`), CORS allow/deny, no stack traces, readable validation errors, no password hashes in responses, production-config guards, CSRF on cross-site-style POST |

## Frontend coverage (`frontend/src/__tests__/`)

Formatting and status helpers, the open-redirect guard, the API client (CSRF header only on mutations, error mapping, network failure message, 204 handling), and accessibility-relevant behaviour of the shared components (label/error association, dialog role and Escape, busy buttons, table and pagination).

## Known gaps (not tested)

- No browser end-to-end tests (Playwright/Cypress); page behaviour was checked by build, type checks, component tests and HTTP-level smoke tests, not by driving a real browser.
- No automated accessibility audit (axe/Lighthouse). The UI uses semantic markup, labels, focus styles, `aria-live` regions and reduced-motion support, but contrast and screen-reader behaviour should be checked manually.
- No concurrency stress test of the booking uniqueness guarantee: it rests on the PostgreSQL partial unique index, which is exercised by the duplicate-booking tests but not by parallel requests.
- Docker images and `docker compose --profile full` were not built or run in the environment where this code was produced.
- AWS deployment, autoscaling and `scripts/loadtest.py` against a cloud endpoint have not been run.
