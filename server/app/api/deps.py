from typing import Generator, Optional
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.config import settings
from app.features.auth.models import User, UserSession

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_db() -> Generator:
    """Dependency to get the DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _token_ids(token: str) -> tuple[int, int, str] | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM], options={"require": ["exp", "iat", "jti", "sub", "sid"]})
        user_id = int(payload["sub"])
        session_id = int(payload["sid"])
        if user_id <= 0 or session_id <= 0:
            return None
        if not isinstance(payload["jti"], str) or not payload["jti"]:
            return None
        return user_id, session_id, payload["jti"]
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        return None


def get_current_session(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> UserSession:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_ids = _token_ids(token)
    session = None
    if token_ids:
        user_id, session_id, token_id = token_ids
        session = db.query(UserSession).filter(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
            UserSession.token_id == token_id,
            UserSession.created_at >= datetime.now(timezone.utc) - timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        ).first()
    if not session or not session.user or not session.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return session


def get_current_user(session: UserSession = Depends(get_current_session)) -> User:
    return session.user

def get_optional_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> Optional[User]:
    if not token:
        return None
    return get_current_session(db=db, token=token).user
