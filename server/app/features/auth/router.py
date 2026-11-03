from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
from sqlalchemy.orm import Session
from datetime import timedelta
import secrets
from app.api import deps
from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import get_password_hash, verify_password, create_access_token
from app.features.auth import models, schemas

router = APIRouter()

@router.post("/register", response_model=schemas.UserOut)
@limiter.limit("5/minute")
def register(request: Request, user_in: schemas.UserCreate, db: Session = Depends(deps.get_db)):
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
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.Token)
@limiter.limit("10/minute")
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

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required",
        )

    username = username.strip().lower()
    user = db.query(models.User).filter(models.User.email == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    session_token = secrets.token_urlsafe(32)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires,
        extra_claims={"sid": session_token}
    )
    
    client_host = request.client.host if request.client else "Unknown"
    new_session = models.UserSession(user_id=user.id, ip_address=client_host, session_token=session_token)
    db.add(new_session)
    db.commit()

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
        current_user.hashed_password = get_password_hash(user_in.password)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_me(current_user: models.User = Depends(deps.get_current_user), db: Session = Depends(deps.get_db)):
    db.delete(current_user)
    db.commit()
    return

@router.get("/sessions", response_model=List[schemas.UserSessionOut])
def get_user_sessions(current_user: models.User = Depends(deps.get_current_user), db: Session = Depends(deps.get_db)):
    sessions = db.query(models.UserSession).filter(models.UserSession.user_id == current_user.id).order_by(models.UserSession.created_at.desc()).all()
    return sessions

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, current_user: models.User = Depends(deps.get_current_user), db: Session = Depends(deps.get_db), token: str = Depends(deps.oauth2_scheme)):
    # Extract session token from JWT to delete the correct session
    session_token = None
    if token:
        try:
            import jwt as _jwt
            payload = _jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            session_token = payload.get("sid")
        except Exception:
            pass
    
    if session_token:
        session_to_delete = db.query(models.UserSession).filter(
            models.UserSession.user_id == current_user.id,
            models.UserSession.session_token == session_token
        ).first()
    else:
        # Fallback for tokens issued before this change
        client_host = request.client.host if request.client else "Unknown"
        session_to_delete = db.query(models.UserSession).filter(
            models.UserSession.user_id == current_user.id,
            models.UserSession.ip_address == client_host
        ).order_by(models.UserSession.created_at.desc()).first()
    
    if session_to_delete:
        db.delete(session_to_delete)
        db.commit()
    return
