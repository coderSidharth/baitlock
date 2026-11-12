from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
from starlette.concurrency import run_in_threadpool
from sqlalchemy.exc import IntegrityError
import ipaddress
from sqlalchemy.orm import Session
from sqlalchemy import update
from datetime import datetime, timedelta, timezone
from app.api import deps
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token
from app.features.auth import models, schemas
from app.core.rate_limit import FailedLoginLimiter

router = APIRouter()
login_limiter = FailedLoginLimiter(settings.LOGIN_RATE_LIMIT, settings.LOGIN_RATE_WINDOW_SECONDS)


def _locked_user(db: Session, user_id: int) -> models.User:
    """Serialize credential checks and session changes, including on SQLite.

    SQLite ignores SELECT FOR UPDATE. A no-op write takes its writer lock;
    PostgreSQL takes a row lock. Reload afterward to discard an ORM snapshot
    obtained before another request changed or deleted the account.
    """
    result = db.execute(update(models.User).where(models.User.id == user_id)
                        .values(id=models.User.id).execution_options(synchronize_session=False))
    user = db.query(models.User).populate_existing().filter(models.User.id == user_id).first() if result.rowcount else None
    if user is None or not user.is_active:
        raise HTTPException(401, "Invalid or inactive account")
    return user

@router.post("/register", response_model=schemas.UserOut)
def register(user_in: schemas.UserCreate, db: Session = Depends(deps.get_db)):
    user_in.email = user_in.email.lower()
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    hashed_password = get_password_hash(user_in.password)
    new_user = models.User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "User with this email already exists")
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.Token)
async def login(request: Request, db: Session = Depends(deps.get_db)):
    username = None
    password = None

    # Support JSON payloads (e.g. extension sending {email, password})
    try:
        data = await request.json()
        if isinstance(data, dict):
            username = data.get("username") or data.get("email")
            password = data.get("password")
    except Exception:
        pass

    # Support form-encoded payloads (e.g. OAuth2PasswordRequestForm or web forms)
    if not username or not password:
        try:
            form = await request.form()
            username = form.get("username") or form.get("email")
            password = form.get("password")
        except Exception:
            pass

    if not isinstance(username, str) or not isinstance(password, str) or not username or not password or len(username) > 320 or len(password) > 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required",
        )

    return await run_in_threadpool(_login_credentials, request, db, username, password)


def _login_credentials(request: Request, db: Session, username: str, password: str):
    username = username.strip().lower()
    limiter_key = (request.client.host if request.client else "unknown", username)
    wait = login_limiter.consume(limiter_key)
    if wait:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed sign-in attempts. Please try again later.",
            headers={"Retry-After": str(wait)},
        )
    user = db.query(models.User).filter(models.User.email == username).first()
    if user:
        user = _locked_user(db, user.id)
    if not user or user.email != username or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    login_limiter.reset(limiter_key)
    if not user.hashed_password.startswith("sha256$"):
        user.hashed_password = get_password_hash(password)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    db.query(models.UserSession).filter(models.UserSession.created_at < cutoff).delete(synchronize_session=False)
    stale = db.query(models.UserSession).filter(models.UserSession.user_id == user.id).order_by(
        models.UserSession.created_at.desc(), models.UserSession.id.desc()
    ).offset(max(0, settings.MAX_SESSIONS_PER_USER - 1)).all()
    for session in stale:
        db.delete(session)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    client_host = request.client.host if request.client else "Unknown"
    try:
        addr = ipaddress.ip_address(client_host)
        client_host = str(ipaddress.ip_network(f"{addr}/{24 if addr.version == 4 else 48}", strict=False))
    except ValueError:
        client_host = "unknown"
    new_session = models.UserSession(user_id=user.id, ip_address=client_host)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    access_token = create_access_token(
        subject=user.id,
        session_id=new_session.id,
        token_id=new_session.token_id,
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(deps.get_current_user)):
    return current_user

@router.put("/me", response_model=schemas.UserOut)
def update_user_me(
    user_in: schemas.UserUpdate,
    current_user: models.User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    current_user = _locked_user(db, current_user.id)
    # Require current_password for sensitive changes (password or email)
    if user_in.password or (user_in.email and user_in.email != current_user.email):
        if not user_in.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to change email or password"
            )
        if not verify_password(user_in.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password"
            )

    if user_in.email and user_in.email != current_user.email:
        existing = db.query(models.User).filter(models.User.email == user_in.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        current_user.email = user_in.email
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
    if user_in.password:
        db.query(models.UserSession).filter(models.UserSession.user_id == current_user.id).delete(synchronize_session=False)
        current_user.hashed_password = get_password_hash(user_in.password)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This email is already registered")
    db.refresh(current_user)
    return current_user

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_me(confirmation: schemas.UserDeleteConfirm, current_user: models.User = Depends(deps.get_current_user), db: Session = Depends(deps.get_db)):
    current_user = _locked_user(db, current_user.id)
    if not verify_password(confirmation.current_password, current_user.hashed_password):
        raise HTTPException(403, "Incorrect current password")
    db.delete(current_user)
    db.commit()
    return

@router.get("/sessions", response_model=List[schemas.UserSessionOut])
def get_user_sessions(current_user: models.User = Depends(deps.get_current_user), db: Session = Depends(deps.get_db)):
    sessions = db.query(models.UserSession).filter(models.UserSession.user_id == current_user.id, models.UserSession.created_at >= datetime.now(timezone.utc) - timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).order_by(models.UserSession.created_at.desc()).all()
    return sessions

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    session: models.UserSession = Depends(deps.get_current_session),
    db: Session = Depends(deps.get_db),
):
    db.delete(session)
    db.commit()
    return
