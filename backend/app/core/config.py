from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://transitflow:transitflow_dev@localhost:5432/transitflow"
    secret_key: str = "dev-only-insecure-key-change-me-please-0123456789"
    qr_signing_key: str = "dev-only-insecure-qr-key-change-me-0123456789"
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool = False
    access_token_minutes: int = 30
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 60
    trust_forwarded_for: bool = False
    payment_provider: str = "simulated"
    allow_simulated_payments_in_production: bool = False
    booking_hold_minutes: int = 15
    operator_timezone: str = "Asia/Kolkata"
    currency: str = "INR"
    log_level: str = "INFO"

    @field_validator("environment")
    @classmethod
    def _env_ok(cls, v: str) -> str:
        if v not in {"development", "test", "production"}:
            raise ValueError("environment must be development, test or production")
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def assert_production_safe(self) -> None:
        if not self.is_production:
            return
        if "dev-only" in self.secret_key or "dev-only" in self.qr_signing_key:
            raise RuntimeError("Insecure default keys in production")
        if len(self.secret_key) < 32 or len(self.qr_signing_key) < 32:
            raise RuntimeError("SECRET_KEY and QR_SIGNING_KEY must be at least 32 characters")
        if self.secret_key == self.qr_signing_key:
            raise RuntimeError("SECRET_KEY and QR_SIGNING_KEY must differ")
        if not self.cookie_secure:
            raise RuntimeError("COOKIE_SECURE must be true in production")
        if self.payment_provider == "simulated" and not self.allow_simulated_payments_in_production:
            raise RuntimeError(
                "Simulated payments in production require ALLOW_SIMULATED_PAYMENTS_IN_PRODUCTION=true"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
