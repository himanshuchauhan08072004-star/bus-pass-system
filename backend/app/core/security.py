import base64
import hashlib
import hmac
import secrets
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.timeutil import utcnow

# argon2-cffi's PasswordHasher defaults to Argon2id.
_ph = PasswordHasher()
_DUMMY_HASH = _ph.hash("transitflow-dummy-password")

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no ambiguous 0/O/1/I/L


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def burn_password_check(password: str) -> None:
    """Spend comparable time when the account does not exist (timing parity)."""
    verify_password(_DUMMY_HASH, password)


def needs_rehash(password_hash: str) -> bool:
    return _ph.check_needs_rehash(password_hash)


def random_code(prefix: str, length: int = 10) -> str:
    return prefix + "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def random_nonce() -> str:
    return secrets.token_hex(6)


def new_csrf_token() -> str:
    return secrets.token_urlsafe(24)


def create_access_token(*, user_id: int, token_version: int, csrf: str, minutes: int, secret: str) -> str:
    now = utcnow()
    payload = {
        "sub": str(user_id),
        "ver": token_version,
        "csrf": csrf,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str, secret: str) -> dict | None:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        return None


# ---- QR tokens -----------------------------------------------------------
# Format: TF1.<kind>.<public code>.<nonce>.<signature>
# kind: B = booking, P = pass. No personal data is embedded. The signature only
# proves the token was issued by this system; validity is ALWAYS checked
# against the database (status, dates, cancellation).


def _qr_sig(kind: str, code: str, nonce: str, key: str) -> str:
    mac = hmac.new(key.encode(), f"{kind}|{code}|{nonce}".encode(), hashlib.sha256).digest()[:16]
    return base64.urlsafe_b64encode(mac).decode().rstrip("=")


def make_qr_token(kind: str, code: str, nonce: str, key: str) -> str:
    return f"TF1.{kind}.{code}.{nonce}.{_qr_sig(kind, code, nonce, key)}"


def parse_qr_token(token: str, key: str) -> tuple[str, str, str] | None:
    parts = token.strip().split(".")
    if len(parts) != 5 or parts[0] != "TF1" or parts[1] not in {"B", "P"}:
        return None
    _, kind, code, nonce, sig = parts
    if not hmac.compare_digest(sig, _qr_sig(kind, code, nonce, key)):
        return None
    return kind, code, nonce
