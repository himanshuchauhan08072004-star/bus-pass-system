from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class ChargeResult:
    provider_ref: str


class PaymentProvider(ABC):
    """Gateway abstraction.

    To integrate a real gateway (Razorpay, Stripe, ...) implement these three
    methods. The application NEVER trusts a status sent by the browser: it
    calls `verify()` (server-to-server) and only then marks a payment as
    succeeded. Raw card data must never touch this backend (use the gateway's
    hosted fields / checkout and send only a token or order id).
    """

    name: str

    @abstractmethod
    def charge(self, *, amount: Decimal, currency: str, reference: str, simulate: str | None = None) -> ChargeResult:
        ...

    @abstractmethod
    def verify(self, provider_ref: str) -> str:
        """Return 'succeeded' or 'failed' as reported by the provider."""

    @abstractmethod
    def refund(self, provider_ref: str, amount: Decimal) -> str:
        """Return a provider refund reference."""
