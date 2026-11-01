from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.features.auth.models import User
from app.api.deps import get_db, get_current_user
from app.features.phishing.schemas import PhishingCheckRequest, PhishingScoreResponse
from app.features.phishing.service import score_phishing_service, normalize_domain

router = APIRouter()

@router.post("/check", response_model=PhishingScoreResponse)
def check_phishing(
    req: PhishingCheckRequest, 
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return score_phishing_service(db, req.url, req.page_text, user_id=user.id, fast_mode=req.fast_mode)

from app.features.phishing.schemas import WhitelistRequest
from app.api.deps import get_current_user
from app.features.phishing.models import UserWhitelist
from urllib.parse import urlparse

@router.get("/whitelist")
def get_whitelist(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    user_id = user.id
    whitelists = db.query(UserWhitelist).filter(UserWhitelist.user_id == user_id).all()
    return {"whitelist": [{"domain": w.domain} for w in whitelists]}

@router.post("/whitelist")
def add_to_whitelist(
    req: WhitelistRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    user_id = user.id
    domain = normalize_domain(req.domain)
    # Check if already whitelisted
    existing = db.query(UserWhitelist).filter(
        UserWhitelist.user_id == user_id,
        UserWhitelist.domain == domain
    ).first()
    
    if not existing:
        whitelist_entry = UserWhitelist(user_id=user_id, domain=domain)
        db.add(whitelist_entry)
        db.commit()
    
    return {"status": "success", "message": f"{domain} has been added to your personal whitelist."}

@router.delete("/whitelist")
def remove_from_whitelist(
    req: WhitelistRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    user_id = user.id
    domain = normalize_domain(req.domain)
    existing = db.query(UserWhitelist).filter(
        UserWhitelist.user_id == user_id,
        UserWhitelist.domain == domain
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return {"status": "success", "message": f"{domain} has been removed from your personal whitelist."}
    
    return {"status": "error", "message": "Domain not found in whitelist."}

from app.features.phishing.models import UserBlocklist

@router.get("/blocklist")
def get_blocklist(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    user_id = user.id
    blocklists = db.query(UserBlocklist).filter(UserBlocklist.user_id == user_id).all()
    return {"blocklist": [{"domain": b.domain, "created_at": b.created_at.isoformat()} for b in blocklists]}

@router.post("/blocklist")
def add_to_blocklist(
    req: WhitelistRequest, # reusing schema since it just needs domain
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    user_id = user.id
    domain = normalize_domain(req.domain)
    existing = db.query(UserBlocklist).filter(
        UserBlocklist.user_id == user_id,
        UserBlocklist.domain == domain
    ).first()
    
    if not existing:
        db.add(UserBlocklist(user_id=user_id, domain=domain))
        db.commit()
    
    return {"status": "success", "message": f"{domain} has been added to blocklist."}

@router.delete("/blocklist")
def remove_from_blocklist(
    req: WhitelistRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    user_id = user.id
    domain = normalize_domain(req.domain)
    existing = db.query(UserBlocklist).filter(
        UserBlocklist.user_id == user_id,
        UserBlocklist.domain == domain
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return {"status": "success"}
    
    return {"status": "error"}
