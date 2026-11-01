from datetime import datetime, timedelta, timezone
from typing import Optional, Union
import jwt
import bcrypt
import hashlib
from app.core.config import settings

def _safe_password_bytes(password: str) -> bytes:
    """Encode and truncate to 72 bytes — bcrypt's maximum input length."""
    return password.encode('utf-8')[:72]

def verify_password(plain_password: str, hashed_password: str) -> bool:
    hashed = hashed_password.encode('utf-8')
    try:
        if bcrypt.checkpw(plain_password.encode('utf-8'), hashed):
            return True
    except ValueError:
        pass
    try:
        if bcrypt.checkpw(_safe_password_bytes(plain_password), hashed):
            return True
    except ValueError:
        pass
    try:
        return bcrypt.checkpw(hashlib.sha256(plain_password.encode('utf-8')).digest(), hashed)
    except ValueError:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(hashlib.sha256(password.encode('utf-8')).digest(), salt).decode('utf-8')

def create_access_token(subject: Union[str, int], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
