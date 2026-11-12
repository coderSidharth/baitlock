from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.rate_limit import FailedLoginLimiter

from app.api.deps import get_db, get_current_user
from app.features.auth.models import User
from app.features.companies import models, schemas
from app.features.phishing.service import require_domain

router = APIRouter()
flag_limiter = FailedLoginLimiter(20, 3600)

@router.post("/flag", response_model=schemas.CompanyFlagOut, status_code=status.HTTP_201_CREATED)
def flag_company(
    payload: schemas.CompanyFlagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wait = flag_limiter.consume((str(current_user.id), "flag"))
    if wait:
        raise HTTPException(429, "Flag rate limit reached", headers={"Retry-After": str(wait)})
    # Use the same normalizer as the phishing service
    try:
        domain = require_domain(payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if payload.flag_type not in ["malicious", "legitimate"]:
        raise HTTPException(status_code=400, detail="Invalid flag type. Must be 'malicious' or 'legitimate'")

    # Check if this user already flagged this domain with the same type
    existing = db.query(models.CompanyFlag).filter(
        models.CompanyFlag.user_id == current_user.id,
        models.CompanyFlag.domain == domain
    ).first()

    if existing:
        existing.flag_type = payload.flag_type
        db.commit()
        db.refresh(existing)
        return existing

    flag = models.CompanyFlag(
        domain=domain,
        flag_type=payload.flag_type,
        user_id=current_user.id
    )

    db.add(flag)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This domain already has your vote; retry to update it")
    db.refresh(flag)
    
    return flag
