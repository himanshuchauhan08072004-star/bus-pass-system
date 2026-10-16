# AWS deployment guide

> **Status, stated plainly:** this guide was written from AWS documentation and the app's configuration. The application has been run and tested locally against PostgreSQL, but **it has not been deployed to AWS from this repository and the autoscaling settings below have not been exercised.** Follow the steps, then record your own evidence (screenshots, load-test numbers). AWS CLI flags for newer services change; confirm each command with `aws <service> <command> help` before running it.

## 1. Evaluation: where to host the application

| Option | Verdict |
|---|---|
| **AWS App Runner** | Not an option for new accounts. AWS closed App Runner to new customers on **30 April 2026** (existing customers can keep using it) and recommends ECS Express Mode for new work. |
| **ECS Express Mode on Fargate** (recommended) | Give it a container image and two IAM roles; it creates the Fargate service, an Application Load Balancer, HTTPS on an AWS-provided domain, CloudWatch Logs and auto scaling. This is the closest match to "dynamically provisioning servers" with the least operational work. |
| **EC2 + Docker Compose** (fallback) | Cheapest and simplest to understand: one instance runs both containers behind a reverse proxy. No automatic scaling; use it if ECS is blocked on your account or budget. See section 8. |

**Database:** Amazon RDS for PostgreSQL (`db.t4g.micro`, single-AZ for the demo, automated backups on). **Secrets:** AWS Secrets Manager. **Images:** Amazon ECR. **S3 is not used**, because the application stores no uploaded files.

## 2. Target architecture

```
Internet ──HTTPS──▶ ALB (created by Express Mode) ──▶ frontend service (Fargate, Next.js :3000)
                                                         │ BACKEND_URL
                                                         ▼
                                       backend service (Fargate, FastAPI :8000, own ALB URL)
                                                         │ 5432 (security-group to security-group)
                                                         ▼
                                              RDS PostgreSQL (private, not public)
Secrets Manager ──▶ SECRET_KEY, QR_SIGNING_KEY, DATABASE_URL (injected into the backend task)
CloudWatch Logs ◀── both services
```

Both services can share one ALB (Express Mode can consolidate services behind a single ALB). The browser only talks to the frontend; the Next.js server proxies `/api/*` to the backend, so the session cookie stays first-party.

## 3. Prerequisites

- AWS account with billing alerts enabled (create a budget alarm first), AWS CLI v2 configured (`aws configure`), Docker Desktop.
- Pick one region (for example `ap-south-1` Mumbai) and use it everywhere.

## 4. Environment variables

**Backend service** (secrets marked ★ come from Secrets Manager, never from the image or Git):

| Variable | Production value |
|---|---|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` ★ | `postgresql+psycopg://<user>:<password>@<rds-endpoint>:5432/transitflow?sslmode=require` |
| `SECRET_KEY` ★ | 48+ random bytes: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `QR_SIGNING_KEY` ★ | a different 48+ byte value |
| `COOKIE_SECURE` | `true` |
| `TRUST_FORWARDED_FOR` | `true` (behind the load balancer) |
| `CORS_ORIGINS` | the frontend's public `https://…` URL |
| `PAYMENT_PROVIDER` / `ALLOW_SIMULATED_PAYMENTS_IN_PRODUCTION` | `simulated` / `true` for the internship demo only; the app refuses to start in production with simulated payments unless you opt in explicitly |
| `RUN_MIGRATIONS` | `true` only for the first deploy (see section 6) |
| `LOG_LEVEL`, `OPERATOR_TIMEZONE`, `CURRENCY` | optional |

**Frontend service:** `BACKEND_URL` = the backend service's public `https://…` URL. `NEXT_PUBLIC_SHOW_PAYMENT_SIMULATOR` is a *build* argument (`--build-arg`), default `true`.

## 5. Step-by-step (PowerShell)

**5.1 Network and database.** In the console: use the default VPC (or your own). Create two security groups: `tf-app` (no inbound rules needed from the internet; the load balancer manages its own) and `tf-db` with an inbound rule **PostgreSQL 5432 from `tf-app` only**. Create an RDS PostgreSQL 16 instance: template *Dev/Test*, `db.t4g.micro`, 20 GB gp3, **Public access: No**, security group `tf-db`, automated backups 7 days, encryption on, database name `transitflow`, master username `tfadmin`, let RDS generate the password (stored in Secrets Manager).

**5.2 Secrets.**

```powershell
$region = "ap-south-1"
$sk = python -c "import secrets; print(secrets.token_urlsafe(48))"
$qk = python -c "import secrets; print(secrets.token_urlsafe(48))"
aws secretsmanager create-secret --region $region --name transitflow/secret-key --secret-string $sk
aws secretsmanager create-secret --region $region --name transitflow/qr-signing-key --secret-string $qk
aws secretsmanager create-secret --region $region --name transitflow/database-url --secret-string "postgresql+psycopg://tfadmin:<password>@<rds-endpoint>:5432/transitflow?sslmode=require"
```

**5.3 Images.**

```powershell
$acct = aws sts get-caller-identity --query Account --output text
$reg = "$acct.dkr.ecr.$region.amazonaws.com"
aws ecr create-repository --region $region --repository-name transitflow-backend
aws ecr create-repository --region $region --repository-name transitflow-frontend
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin $reg

cd CodeAlpha_CloudBasedBusPassSystem
docker build -t "$reg/transitflow-backend:v1" backend
docker build -t "$reg/transitflow-frontend:v1" frontend
docker push "$reg/transitflow-backend:v1"
docker push "$reg/transitflow-frontend:v1"
```

**5.4 IAM roles** (see section 7 for policies): a *task execution role* (trust `ecs-tasks.amazonaws.com`, managed policy `AmazonECSTaskExecutionRolePolicy`, plus the inline policy that reads the three secrets) and an *infrastructure role* for Express Mode (trust `ecs.amazonaws.com`, using the AWS managed policy for Express Mode infrastructure, which the console can create for you).

**5.5 Backend service.** Console: **Amazon ECS → Express mode → Create**. Image URI = backend image; task execution role and infrastructure role from 5.4; **Container port 8000**; **Health check path `/health`** (Express Mode's default path differs, so change it); CPU 0.5 vCPU, memory 1 GB; add the environment variables and secrets from section 4 (Secrets Manager ARNs for the ★ values); choose the VPC and subnets and attach security group `tf-app`; under scaling set **minimum 1, maximum 1 for the first deploy**. CLI equivalent: `aws ecs create-express-gateway-service` (required: `--infrastructure-role-arn`; also `--cpu`, `--memory`, `--cluster`, `--scaling-target`, `--primary-container`; check `help` for the exact JSON shapes).

**5.6 Frontend service.** Same wizard with the frontend image, **container port 3000**, health check path `/login`, environment `BACKEND_URL=https://<backend-url>`; scaling min 1.

**5.7 Verify.** Open `https://<frontend-url>/`, then `https://<backend-url>/health/ready` (should return `{"status":"ready"}`).

## 6. Database migrations and first data

Migrations are Alembic. For the first deploy set `RUN_MIGRATIONS=true` on the backend with scaling pinned to one task: the container runs `alembic upgrade head` before starting the API. Then set it back to `false` and raise the scaling maximum. During a rolling deploy two tasks can overlap briefly, so for a real production pipeline run `alembic upgrade head` once as a separate step (for example an `aws ecs run-task` with a command override) instead of at container start.

Demo data and the first administrator need database access from inside the VPC. Use **ECS Exec** on the backend task, or a temporary EC2 instance or CloudShell VPC environment:

```bash
ENVIRONMENT=development SEED_ADMIN_PASSWORD='<strong password>' SEED_PASSENGER_PASSWORD='<strong password>' python seed.py
```

(`seed.py` refuses to run when `ENVIRONMENT=production`, hence the override on that one command.) To make a real user an administrator instead: `UPDATE users SET role = 'admin' WHERE email = '<email>';`.

## 7. IAM permissions (least privilege)

Task execution role: managed `AmazonECSTaskExecutionRolePolicy` plus

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue"],
    "Resource": [
      "arn:aws:secretsmanager:<region>:<account>:secret:transitflow/secret-key-*",
      "arn:aws:secretsmanager:<region>:<account>:secret:transitflow/qr-signing-key-*",
      "arn:aws:secretsmanager:<region>:<account>:secret:transitflow/database-url-*"
    ]
  }]
}
```

Deployer (your IAM user or CI role): ECR push (`ecr:GetAuthorizationToken` on `*`; `ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage` on the two repositories), ECS service create/update permissions, and `iam:PassRole` limited to the two role ARNs. Do not use root credentials, and never commit access keys: use `aws configure`, SSO, or GitHub OIDC for CI.

## 8. EC2 fallback (single instance)

1. Launch Ubuntu `t3.small`, security group allowing 80/443 from anywhere and 22 from your IP only; install Docker and the compose plugin; attach an instance role if you read secrets from Secrets Manager.
2. Put the RDS instance in the same VPC with `tf-db` allowing 5432 from the instance's security group.
3. On the instance create a compose file with `backend`, `frontend` and a `caddy` reverse proxy that terminates HTTPS (Caddy obtains certificates automatically for a domain pointing at the instance; a free `<ip>.sslip.io` name works for demos), pass the same environment variables as section 4, and proxy `/` to `frontend:3000`. This path has no automatic scaling and the compose file is not included or tested in this repository.

## 9. Operations

- **HTTPS:** terminated at the ALB (Express Mode) with an AWS-provided certificate; add a custom domain through Route 53 and ACM if desired. The backend sends HSTS in production and requires secure cookies.
- **Logging:** both containers log to stdout, which Express Mode sends to CloudWatch Logs. Logs contain method, path, status and duration only: no bodies, cookies, tokens or query strings.
- **Error monitoring (recommended):** CloudWatch alarms on ALB 5xx count and target response time, on unhealthy target count, and on RDS CPU, free storage and connections; optionally add Sentry.
- **Backups and recovery:** RDS automated backups (7+ days, point-in-time restore) and a manual snapshot before each release. Restore creates a *new* instance; update `DATABASE_URL` and redeploy. Test a restore once before you rely on it. For production use Multi-AZ.
- **Releases:** build and push a new image tag, update the service to that tag, watch health checks; roll back by redeploying the previous tag. Take the snapshot first when a release includes a migration.
- **Secret rotation:** rotating `SECRET_KEY` signs everyone out; rotating `QR_SIGNING_KEY` invalidates every issued QR code. Plan both.

## 10. Cost considerations (estimates, verify with the AWS Pricing Calculator)

For an always-on demo in one region, expect very roughly **US$60–90 per month**: two small Fargate tasks (0.5 vCPU / 1 GB each, about US$15–20 each), an Application Load Balancer (about US$16 plus usage), RDS `db.t4g.micro` single-AZ with 20 GB (about US$14–18), Secrets Manager (US$0.40 per secret), plus CloudWatch logs and data transfer. The EC2 route is roughly half that. Free-tier and credit terms vary by account age, so check your account's current terms. **Delete the services, load balancer, RDS instance, secrets and ECR images when the evaluation is over**, and set a billing alarm now.
