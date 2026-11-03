from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.features.auth.models import User
from app.features.companies import models, schemas
from app.features.phishing.service import normalize_domain, is_valid_domain

router = APIRouter()

@router.post("/flag", response_model=schemas.CompanyFlagOut, status_code=status.HTTP_201_CREATED)
def flag_company(
    payload: schemas.CompanyFlagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Use the same normalizer as the phishing service
    domain = normalize_domain(payload.url)
    if not is_valid_domain(domain):
        raise HTTPException(status_code=422, detail=f"'{payload.url}' is not a valid domain name")

    if payload.flag_type not in ["malicious", "legitimate"]:
        raise HTTPException(status_code=400, detail="Invalid flag type. Must be 'malicious' or 'legitimate'")

    # Check if this user already flagged this domain with the same type
    existing = db.query(models.CompanyFlag).filter(
        models.CompanyFlag.user_id == current_user.id,
        models.CompanyFlag.domain == domain,
        models.CompanyFlag.flag_type == payload.flag_type
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="You have already flagged this domain.")

    flag = models.CompanyFlag(
        domain=domain,
        flag_type=payload.flag_type,
        user_id=current_user.id
    )

    db.add(flag)
    db.commit()
    db.refresh(flag)
    
    return flag
