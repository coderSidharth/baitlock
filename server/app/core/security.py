from datetime import datetime, timedelta, timezone
from typing import Optional, Union
import logging
import jwt
import bcrypt
import hashlib
from app.core.config import settings

logger = logging.getLogger("baitlock.security")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Versioned hashes cost one bcrypt check; unversioned hashes migrate at login."""
    try:
        if hashed_password.startswith("sha256$"):
            candidate = hashlib.sha256(plain_password.encode()).hexdigest().encode()
            return bcrypt.checkpw(candidate, hashed_password.removeprefix("sha256$").encode())
        # shortcut: retain both deployed legacy formats until all users sign in.
        hashed = hashed_password.encode()
        for candidate in (hashlib.sha256(plain_password.encode()).hexdigest().encode(),
                          hashlib.sha256(plain_password.encode()).digest()):
            if bcrypt.checkpw(candidate, hashed):
                return True
    except (ValueError, TypeError):
        return False
    return False


def get_password_hash(password: str) -> str:
    """Hash a password for storage using bcrypt(sha256(password).hexdigest()).

    SHA-256 is applied first to safely handle passwords longer than bcrypt's
    72-byte limit. hexdigest() (not digest()) is used to avoid null bytes in
    the bcrypt input, which some implementations truncate at.
    """
    pw_bytes = hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8")
    salt = bcrypt.gensalt()
    return "sha256$" + bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def create_access_token(subject: Union[str, int], session_id: int, token_id: str, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "exp": expire,
        "iat": now,                  # issued-at: enables "revoke tokens before time X"
        "jti": token_id,            # bound to this session, even if a DB id is reused
        "sub": str(subject),
        "sid": session_id,
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
