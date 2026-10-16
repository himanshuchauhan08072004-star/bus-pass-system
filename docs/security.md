# Security

This lists what is implemented and tested, then what still needs hardening before real production use. Nothing here is a guarantee; it is a description of the code.

## Implemented

| Area | Control | Where / test |
|---|---|---|
| Passwords | Argon2id (argon2-cffi defaults), automatic rehash on login when parameters change, 10+ chars with letter and digit | `core/security.py`, `test_auth.py` |
| Login | Generic error for wrong email or password, dummy hash for unknown email (timing parity), rate limit per IP and per email | `api/v1/auth.py`, `test_security.py` |
| Sessions | httpOnly `SameSite=Lax` cookie (`Secure` in production), 30-minute JWT; `token_version` revokes sessions on password change, deactivation and role change | `core/deps.py`, `test_auth.py` |
| CSRF | Per-session token inside the signed session; all non-GET requests need `X-CSRF-Token` to match | `test_auth.py::test_csrf_*`, smoke test |
| Authorization | Role read from the database on every request, never from the client or token; admin router guarded by `require_admin`; every passenger query filtered by user id (other users get 404) | `test_admin.py` (all admin endpoints × anonymous/passenger), `test_bookings.py` |
| Input validation | Pydantic models with length/range/enum limits, strict timetable and date-window validation, readable 422 errors | `schemas/schemas.py` |
| SQL injection | SQLAlchemy ORM with bound parameters everywhere; no string-built SQL | `test_security.py` (injection strings through every search/filter parameter) |
| Pricing integrity | Fares and pass prices computed on the server; client price fields ignored | `test_bookings.py`, smoke test |
| Payment integrity | Status set only after provider `verify()`; idempotent; attempt cap; amounts constrained in the database; no card data stored | `services/payments.py` |
| Ticket integrity | HMAC-signed opaque QR tokens, no personal data, DB-checked validity, nonce rotation | `test_verify.py` |
| Duplicate protection | Partial unique indexes (bookings, pending applications) | `test_bookings.py`, `test_passes.py` |
| Rate limiting | Login, register, payment, write and verify endpoints | `core/rate_limit.py`, `test_security.py` |
| CORS | Explicit origin list, explicit methods and headers, credentials allowed only for listed origins | `test_security.py` |
| Headers | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Cache-Control: no-store` on API; HSTS in production; frontend sets nosniff, frame, referrer, permissions and HSTS headers | `main.py`, `next.config.mjs` |
| Logging | Method, path, status and duration only; no bodies, cookies, tokens or query strings; unhandled errors return a generic 500 | `main.py` |
| Secrets | All from environment; production refuses default, short, identical keys, insecure cookies, or simulated payments without an explicit opt-in; `.env` is git-ignored; the seed script generates random passwords | `core/config.py`, `test_security.py` |
| Audit | Authentication, booking, payment, pass and every admin action recorded with actor and IP | `services/audit.py`, `test_admin.py` |
| Open redirect | `?next=` accepts only same-site relative paths | `lib/nav.ts`, `format.test.ts` |
| API docs | `/docs` and `/openapi.json` disabled in production | `main.py` |

## Still needs production hardening

- **Email verification, password reset and MFA** (especially for administrators) are not implemented.
- **Account lockout** is rate limiting only. There is no progressive lockout or CAPTCHA.
- **Rate limiter is per instance** (see `docs/scaling.md`). Add AWS WAF or Redis for a shared limit. `X-Forwarded-For` is trusted when `TRUST_FORWARDED_FOR=true`, so restrict direct access to the backend.
- **Content-Security-Policy** is not set. The inline theme script and Next.js inline scripts need a nonce-based policy.
- **JWT uses a shared symmetric key (HS256)**, has no refresh-token flow and a fixed 30-minute lifetime (users must sign in again).
- **Audit log is append-only by convention**, not enforced by database permissions. Use a restricted DB role or ship logs to immutable storage for real compliance.
- **Payments are simulated.** A real gateway needs webhook signature verification, reconciliation and PCI scoping (use hosted checkout so card data never touches this system).
- **QR verification is public** and rate limited; for real boarding use authenticated conductor devices.
- **Data protection:** no data-retention, export or deletion workflow (GDPR/DPDP style). IP addresses are stored in the audit log.
- **Database:** use TLS to RDS (`sslmode=require`), encryption at rest, least-privilege DB user (the app needs no DDL rights after migration), Multi-AZ, tested restores.
- **Supply chain:** run `pip-audit` and `npm audit` in CI and pin base images by digest.
- **Penetration test / threat model review** has not been done.
