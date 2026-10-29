# TransitFlow — Cloud-Based Bus Pass System

A cloud-ready digital bus ticketing and pass platform. Passengers discover routes, book tickets with a QR code, apply for and renew bus passes, and pay through a payment abstraction. Administrators manage the network, fares, passes, bookings and users. Built for the **CodeAlpha Cloud Computing Internship, Task 3: Cloud-Based Bus Pass System**.

# LIVE LINK : https://bus-pass-system-rust.vercel.app/

> **Demo project.** Routes, fares and payments are demonstration data (`DEMO-` route codes). Payments use a simulated provider: no money moves and no card data is collected.

## Highlights

- **Server-side pricing.** Clients never send a price. Fares and pass prices are computed on the backend; tampered fields are ignored.
- **Verified payments.** A payment is marked successful only after the backend verifies it with the provider (`verify()`); the browser cannot set a status.
- **No duplicate or clashing bookings.** A partial unique index in PostgreSQL stops a user holding two live bookings for the same departure slot, even under concurrent requests.
- **Tamper-resistant QR tickets.** The QR carries an opaque, HMAC-signed token with no personal data. Validity is always decided from the database (cancelled, expired or future-dated tickets fail).
- **Real auth.** Argon2id hashing, httpOnly session cookie, per-session CSRF token, role checked from the database on every request, session revocation on password change or deactivation, rate limiting on sensitive endpoints.
- **Cloud-ready.** Environment-based config, production safety checks, health endpoints, structured logging, Docker images, Alembic migrations, AWS deployment guide.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, Lucide, qrcode.react |
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic |
| Database | PostgreSQL 16 (SQLite is used only for the fast default test run) |
| Auth | Argon2id, JWT in httpOnly cookie, CSRF token |
| Tests | Pytest (86 tests), Vitest + Testing Library (25 tests) |
| Cloud | AWS: ECS Express Mode on Fargate (ALB, HTTPS, autoscaling) + RDS PostgreSQL + Secrets Manager + ECR; EC2 as a fallback (see `docs/deployment-aws.md`) |

## Repository layout

```
backend/    FastAPI app, models, migrations, seed data, tests
frontend/   Next.js app (also proxies /api/* to the backend)
docs/       architecture, schema, API, security, AWS deployment, scaling, testing, task mapping
scripts/    loadtest.py
.github/    CI workflow
docker-compose.yml
```

## Quick start (Windows PowerShell)

Prerequisites: Python 3.12+, Node.js 20+ (22 recommended), Git, and either Docker Desktop or a local PostgreSQL 16.

**1. Database** (from the repository root)

```powershell
cd CodeAlpha_CloudBasedBusPassSystem
docker compose up -d db
```

No Docker? Install PostgreSQL, create a database and user, and set `DATABASE_URL` in `backend/.env` accordingly.

**2. Backend** (new terminal)

```powershell
cd CodeAlpha_CloudBasedBusPassSystem\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope Process Bypass
pip install -r requirements-dev.txt
Copy-Item .env.example .env
alembic upgrade head
$env:SEED_ADMIN_PASSWORD = "ChooseAStrongAdminPass1"
$env:SEED_PASSENGER_PASSWORD = "ChooseAStrongPassengerPass1"
python seed.py
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs · Health: http://localhost:8000/health/ready

**3. Frontend** (another terminal)

```powershell
cd CodeAlpha_CloudBasedBusPassSystem\frontend
npm install
npm run dev
```

Open http://localhost:3000. Sign in as `admin@transitflow.demo` or `passenger@transitflow.demo` with the passwords you set for the seed script, or register a new passenger.

**Whole stack in containers instead:** `docker compose --profile full up --build`, then run the seed script inside the backend container (`docker compose exec backend python seed.py`).

## Tests

```powershell
cd backend
pytest                                   # 86 tests, SQLite, no setup needed
$env:TEST_DATABASE_URL = "postgresql+psycopg://transitflow:transitflow_dev@localhost:5433/transitflow_test"
pytest                                   # same suite on PostgreSQL (create the database first)

cd ..\frontend
npm test                                 # 25 unit/component tests
npm run lint ; npm run typecheck ; npm run build
```

See `docs/testing.md` for what is covered and what is not.

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Components, request flow, key design decisions, QR and payment design |
| [docs/database-schema.md](docs/database-schema.md) | Tables, constraints, indexes, relationships |
| [docs/api.md](docs/api.md) | Endpoint reference |
| [docs/security.md](docs/security.md) | Implemented controls and honest list of what still needs production hardening |
| [docs/deployment-aws.md](docs/deployment-aws.md) | AWS architecture, IAM, env vars, step-by-step deploy, backups, cost notes |
| [docs/scaling.md](docs/scaling.md) | Scaling strategy and what changes with multiple instances |
| [docs/testing.md](docs/testing.md) | Test strategy, commands, verified results, known gaps |
| [docs/task-mapping.md](docs/task-mapping.md) | CodeAlpha Task 3 requirements mapped to implementation and evidence |
| [docs/screenshots-checklist.md](docs/screenshots-checklist.md) | Screenshots to capture for submission |
| [docs/demo-video-outline.md](docs/demo-video-outline.md) | Script for the LinkedIn demo video |

## Business rules

- **Fare** = `max(min_fare, base_fare + per_km_rate × distance between chosen stops)` × passengers, rounded half-up to 2 decimals.
- **Booking hold:** an unpaid booking holds the slot for 15 minutes, then expires automatically.
- **Cancellation:** 24 h or more before departure = 100% refund; 2–24 h = 50%; under 2 h = not allowed. Administrator cancellations refund 100%.
- **Passes:** apply, pay, administrator approves or rejects (rejection refunds in full). Concession passes (student, senior) need a declaration the administrator verifies. Renewal opens 7 days before expiry; the new term starts the day after the old one ends; paid renewals are approved automatically because eligibility was already verified.

## Known limitations

Honest summary; details in `docs/security.md` and `docs/scaling.md`.

- Payments are simulated. Integrating a real gateway means implementing three methods in `backend/app/payments/`.
- Seat inventory is not modelled: bookings are not limited by bus capacity.
- No email verification or password reset flow.
- The rate limiter is in-memory per instance.
- The application has been run and tested locally (SQLite and PostgreSQL). It has **not** been deployed to AWS from this repository, and autoscaling has **not** been configured or load-tested; the AWS guide describes how to do both.

## Himanshu Chauhan
