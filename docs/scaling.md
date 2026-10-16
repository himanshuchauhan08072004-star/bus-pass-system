# Scaling strategy

**Honest status:** the application is *designed* to scale horizontally and is verified to run correctly on PostgreSQL. Automatic scaling has not been configured or load-tested in this repository. This document says what makes scaling possible, what must change when running more than one instance, and how to prove it.

## Why the application can scale out

- **Stateless backend.** No session or request state lives in process memory: the session is a signed cookie, and everything else is in PostgreSQL. Any instance can serve any request, so no sticky sessions are needed.
- **Consistency lives in the database.** Duplicate bookings, double payment, and double review are prevented by unique/partial-unique indexes, row locks (`SELECT … FOR UPDATE` on payments and applications) and transactions, not by in-process locks. They behave the same with 1 or 20 instances.
- **Expiry without background workers.** Unpaid booking holds are expired lazily from the database state on the next relevant request, so no scheduler has to be run exactly once.
- **Container images and health checks.** `/health` (liveness) and `/health/ready` (database) support load-balancer checks and rolling deploys.
- **Environment-driven configuration** makes instances identical.

## What changes when moving from one instance to many

| Concern | Single instance | Multiple instances |
|---|---|---|
| Rate limiting | In-process counters (default) | Counters are **per instance**, so the effective limit is multiplied by the instance count. Move to AWS WAF rate-based rules or Redis (ElastiCache) for a shared limit. |
| Migrations | `RUN_MIGRATIONS=true` is acceptable | Run `alembic upgrade head` once as a separate release step; never from every instance at start-up. |
| DB connections | Pool of 5 + 10 overflow per process | Total connections = instances × 15. Compare with the RDS `max_connections` for your instance class; lower the pool size, or add RDS Proxy / PgBouncer, before raising the instance maximum. |
| Client IP for limits and audit | Direct | Set `TRUST_FORWARDED_FOR=true` behind the load balancer. Because the backend URL is also publicly reachable, a caller who bypasses the frontend can spoof `X-Forwarded-For`; restrict the backend to the frontend's security group or an internal load balancer to close that gap. |
| Logs | Local stdout | Centralised in CloudWatch Logs; add a request id if you need cross-service tracing. |
| Deployments | Restart | Rolling deploy behind the load balancer with health checks. |
| Secrets | `.env` | Secrets Manager; rotation plan for `SECRET_KEY` and `QR_SIGNING_KEY`. |

## Autoscaling on AWS (ECS Express Mode)

Express Mode attaches Application Auto Scaling to the ECS service; set the minimum and maximum task count (for example min 2, max 6 for a demo) and review the scaling metric it uses (CPU utilisation / request count per target) in the service's *Additional configurations*. Keep `min ≥ 2` in two Availability Zones if you want availability during a task failure. Scaling out takes minutes (a new Fargate task must start and pass health checks), so it handles sustained growth, not instant spikes; keep headroom for those.

## Bottlenecks to expect, in order

1. **Database connections and CPU** on a small RDS instance → RDS Proxy, a larger class, then Multi-AZ.
2. **Route search** currently loads active routes and filters in Python (fine for hundreds of routes). Next steps: push filtering and sorting into SQL, cache the route list (it changes rarely) in a CDN or Redis, add pagination in the UI.
3. **Reads vs writes:** route/search/verify traffic is read-heavy → RDS read replica for those endpoints.
4. **Single-writer hot spots:** booking inserts are per-user rows and scale well; seat inventory per departure (not implemented) would need careful locking or counters.

## How to prove it (do this and keep the output)

1. Deploy with min 1, max 4 tasks (or your own numbers).
2. From your laptop: `python scripts/loadtest.py --base-url https://<backend-url> --concurrency 50 --duration 120`.
3. Watch in CloudWatch: ALB request count, target response time p95, ECS running task count, CPU, RDS connections.
4. Record the before/after task count and latency in `docs/task-mapping.md`. Only then say "autoscaling was tested".
