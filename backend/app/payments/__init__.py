from app.core.config import get_settings
from app.payments.base import ChargeResult, PaymentProvider  # noqa: F401
from app.payments.simulated import SimulatedProvider


def get_provider() -> PaymentProvider:
    name = get_settings().payment_provider
    if name == "simulated":
        return SimulatedProvider()
    raise RuntimeError(f"Unknown PAYMENT_PROVIDER '{name}'. Implement it in app/payments/.")
