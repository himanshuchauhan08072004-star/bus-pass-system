import logging
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.v1 import admin, auth, bookings, catalog, dashboard, health, passes, verify
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import setup_logging
from app.core.rate_limit import TooManyRequests

settings = get_settings()
setup_logging(settings.log_level)
settings.assert_production_safe()
logger = logging.getLogger("transitflow")

app = FastAPI(
    title="TransitFlow API",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


@app.middleware("http")
async def security_headers_and_logging(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    if settings.is_production:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    ms = (time.perf_counter() - start) * 1000
    # Path only: no query string, headers, cookies or bodies are logged.
    if not request.url.path.startswith("/health"):
        logger.info("%s %s -> %s %.0fms", request.method, request.url.path, response.status_code, ms)
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    headers = {"Retry-After": "60"} if isinstance(exc, TooManyRequests) else None
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=headers)


@app.exception_handler(IntegrityError)
async def integrity_handler(request: Request, exc: IntegrityError):
    logger.warning("Integrity error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=409, content={"detail": "The request conflicts with existing data"})


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    errors = []
    for e in exc.errors():
        loc = [str(p) for p in e.get("loc", []) if p not in ("body", "query", "path")]
        msg = str(e.get("msg", "Invalid value")).removeprefix("Value error, ")
        errors.append({"field": ".".join(loc), "message": msg})
    detail = "; ".join(f"{e['field']}: {e['message']}" if e["field"] else e["message"] for e in errors)
    return JSONResponse(status_code=422, content={"detail": detail, "errors": errors})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(health.router)  # /health for load balancers
API = "/api/v1"
for r in (health.router, auth.router, catalog.router, bookings.router, passes.router, dashboard.router, verify.router, admin.router):
    app.include_router(r, prefix=API)

logger.info("TransitFlow API started env=%s", settings.environment)
