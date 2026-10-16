# Mapping to CodeAlpha Task 3 — Cloud-Based Bus Pass System

Status column is deliberately strict: **Done** = implemented and verified here; **Ready** = implemented and documented, needs you to run it on AWS and capture evidence.

| CodeAlpha requirement | Implementation | Evidence | Status |
|---|---|---|---|
| Develop an online ticket booking system hosted on the cloud | Full web app: route search, booking, QR tickets, passes, payments, admin console. Container images and an AWS deployment guide (ECS Express Mode + RDS) | App runs locally; `docs/deployment-aws.md` | App **Done**; cloud hosting **Ready** (deploy, then add the public URL and screenshots) |
| Prevent ticket **loss** | Tickets and passes are stored in the account and re-openable at any time; booking history; QR re-rendered from the stored record | `test_bookings.py::test_history_and_dashboard`, booking detail page | **Done** |
| Prevent ticket **theft/forgery** | Signed opaque QR (no personal data) verified against the database every time; cancelled/expired/other-day tickets fail; nonce rotation; authentication, CSRF and per-user isolation protect the account | `test_verify.py`, `test_auth.py`, `test_bookings.py::test_users_cannot_see_or_pay_others_bookings` | **Done** |
| Prevent **incorrect pricing** | One server-side pricing function; client price fields ignored; pass price snapshot; DB `CHECK` constraints; payment status only after provider verification | `test_catalog.py`, `test_bookings.py`, smoke test (tampered `total_fare`) | **Done** |
| Handle high traffic by **dynamically provisioning servers** | Stateless containerised backend and frontend; DB-enforced consistency; health checks; ECS Express Mode autoscaling configuration documented with min/max and the evidence procedure | `docs/scaling.md`, `docs/deployment-aws.md`, `scripts/loadtest.py` | Design **Done**; autoscaling **Ready, not yet configured or tested**. Add your load-test numbers here once measured |
| Scalability and reliability improvements over traditional booking sites | See table below | `docs/architecture.md`, `docs/scaling.md` | **Done** (design), measured results **Ready** |
| **Test** and deploy for a seamless booking experience | 86 backend tests (SQLite + PostgreSQL), 25 frontend tests, lint/typecheck/build, CI workflow, smoke test; deployment guide | `docs/testing.md`, `.github/workflows/ci.yml` | Testing **Done**; deployment **Ready** |

## Improvements over a traditional booking site

| Traditional weakness | TransitFlow approach |
|---|---|
| Price accepted from the browser or recomputed inconsistently | Single server-side fare engine; price snapshots; DB constraints |
| Double bookings under concurrent clicks | Partial unique index makes them impossible, race-safe |
| Payment marked paid from a redirect URL | Server verifies with the provider; idempotent; attempt-limited; refunds recorded |
| Paper or screenshot tickets that can be forged or reused after refund | Signed QR + live database check; cancellation invalidates it |
| Seats held forever by abandoned checkouts | 15-minute holds that expire automatically |
| Manual, opaque pass approvals | Pass workflow with payment-before-review, refund on rejection, renewal rules, audit trail |
| One big server | Stateless containers behind a load balancer with autoscaling, health checks, managed database with backups |
| Schema drift between environments | Alembic migrations checked in CI (`alembic check`) |

## Evidence to add before submitting

1. Public URL of the deployed frontend and backend `/health/ready`.
2. ECS/ALB console screenshots showing the service, scaling settings and healthy targets.
3. Load-test output and CloudWatch graphs showing task count and latency (see `docs/scaling.md`).
4. The screenshots listed in `docs/screenshots-checklist.md`.
