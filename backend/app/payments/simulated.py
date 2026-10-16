import secrets
from decimal import Decimal

from app.payments.base import ChargeResult, PaymentProvider


class SimulatedProvider(PaymentProvider):
    """Development provider. No money moves, no card data is accepted.

    The outcome is encoded in the provider reference that only the server
    creates, and `verify()` reads it back, mimicking a server-side gateway
    lookup.
    """

    name = "simulated"

    def charge(self, *, amount: Decimal, currency: str, reference: str, simulate: str | None = None) -> ChargeResult:
        outcome = "FAIL" if simulate == "failure" else "OK"
        return ChargeResult(provider_ref=f"SIM-{outcome}-{secrets.token_hex(8)}")

    def verify(self, provider_ref: str) -> str:
        if provider_ref.startswith("SIM-OK-"):
            return "succeeded"
        return "failed"

    def refund(self, provider_ref: str, amount: Decimal) -> str:
        return f"SIM-RF-{secrets.token_hex(8)}"
