"""Password hashing (stdlib PBKDF2-HMAC, no native extension needed) and JWT
session tokens. Not a substitute for a hardened, audited auth stack — this is
a small local service with no external attack surface beyond localhost — but
passwords are salted+hashed (never stored or compared in plaintext) and
tokens are signed, which is the load-bearing part."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

PBKDF2_ITERATIONS = 260_000
TOKEN_ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=7)

# In production this MUST be set via env var — the fallback exists so the
# service still boots for local/dev use without extra setup, at the cost of
# every dev install sharing one well-known key.
SECRET_KEY = os.environ.get("TABULA_SECRET_KEY", "dev-only-insecure-secret-change-me-before-any-real-deploy")


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Returns (hash, salt), both hex-encoded."""
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return digest.hex(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    candidate, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate, password_hash)


def create_access_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {"sub": subject, "iat": now, "exp": now + TOKEN_TTL}
    return jwt.encode(payload, SECRET_KEY, algorithm=TOKEN_ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """Returns the subject (user id) if the token is valid and unexpired, else None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[TOKEN_ALGORITHM])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")
