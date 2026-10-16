from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.features.phishing.models import PhishingEvent
from app.features.fraud.models import FraudEvent
import json

router = APIRouter()

from app.api.deps import get_db, get_current_user
from app.features.auth.models import User

@router.get("")
@router.get("/")
def get_events(
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns unified recent events (both phishing and fraud) for the dashboard audit trail feed.
    """
    phishing_records = db.query(PhishingEvent).filter(PhishingEvent.user_id == current_user.id).order_by(PhishingEvent.created_at.desc()).limit(limit).all()
    fraud_records = db.query(FraudEvent).filter(FraudEvent.user_id == current_user.id).order_by(FraudEvent.created_at.desc()).limit(limit).all()

    combined = []

    for p in phishing_records:
        reasons = []
        try:
            reasons = json.loads(p.reasons_jsonb) if p.reasons_jsonb else []
        except Exception:
            reasons = []

        combined.append({
            "id": f"phish_{p.id}",
            "type": "phishing",
            "target": p.input_url,
            "input_data": {"url": p.input_url, "page_text": p.input_text},
            "score": p.final_score,
            "verdict": p.verdict,
            "reasons": reasons,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })

    for f in fraud_records:
        reasons = []
        try:
            reasons = json.loads(f.reasons_jsonb) if f.reasons_jsonb else []
        except Exception:
            reasons = []

        combined.append({
            "id": f"fraud_{f.id}",
            "type": "fraud",
            "target": f"${f.amount:,.2f} txn",
            "input_data": {"amount": f.amount, "velocity": f.velocity, "hour": f.hour, "geo_distance": f.geo_distance},
            "score": f.final_score,
            "verdict": f.verdict,
            "reasons": reasons,
            "created_at": f.created_at.isoformat() if f.created_at else None
        })

    # Sort combined by created_at descending
    combined.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return {"events": combined[:limit], "total": len(combined[:limit])}
