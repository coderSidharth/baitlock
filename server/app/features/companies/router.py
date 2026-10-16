from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from urllib.parse import urlparse

from app.api.deps import get_db, get_optional_user
from app.features.auth.models import User
from app.features.companies import models, schemas

router = APIRouter()

@router.post("/flag", response_model=schemas.CompanyFlagOut, status_code=status.HTTP_201_CREATED)
def flag_company(
    payload: schemas.CompanyFlagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user)
):
    try:
        parsed_url = urlparse(payload.url)
        domain = parsed_url.netloc or payload.url
    except Exception:
        domain = payload.url

    # Normalize domain
    domain = domain.lower().replace("www.", "")

    if payload.flag_type not in ["malicious", "legitimate"]:
        raise HTTPException(status_code=400, detail="Invalid flag type. Must be 'malicious' or 'legitimate'")

    flag = models.CompanyFlag(
        domain=domain,
        flag_type=payload.flag_type,
        user_id=current_user.id if current_user else None
    )

    db.add(flag)
    db.commit()
    db.refresh(flag)
    
    return flag
