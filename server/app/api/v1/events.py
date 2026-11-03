from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.features.auth.models import User
from app.features.phishing.models import PhishingEvent
from app.features.fraud.models import FraudEvent
from typing import List, Dict, Any, Optional

import json

router = APIRouter(tags=["Events"])

@router.get("/events")
def list_events(
    type: str | None = Query(default=None, description="Filter by event type: phishing | fraud"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve recent events for the dashboard live feed.

    Only the rows needed for the requested page are loaded: the newest
    (offset + limit) rows of each table always contain the newest (offset + limit)
    rows of the merged, time-ordered feed.
    """
    events: List[Dict[str, Any]] = []
    window = offset + limit
    total = 0

    if type is None or type == "phishing":
        phishing_base = db.query(PhishingEvent).filter(PhishingEvent.user_id == user.id)
        total += phishing_base.count()
        phishing_db = phishing_base.order_by(PhishingEvent.created_at.desc()).limit(window).all()
        for e in phishing_db:
            try:
                reasons = json.loads(e.reasons_jsonb) if e.reasons_jsonb else []
            except Exception:
                reasons = []
            events.append({
                "id": f"p_{e.id}",
                "type": "phishing",
                "target": e.input_url,
                "score": e.final_score,
                "verdict": e.verdict,
                "reasons": reasons,
                "tier": "critical" if any(k in (e.verdict or "") for k in ["CRITICAL", "BLOCKED"]) else "high" if "HIGH" in (e.verdict or "") or "REVIEW" in (e.verdict or "") else "moderate" if "MODERATE" in (e.verdict or "") else "safe",
                "created_at": e.created_at
            })
            
    if type is None or type == "fraud":
        fraud_base = db.query(FraudEvent).filter(FraudEvent.user_id == user.id)
        total += fraud_base.count()
        fraud_db = fraud_base.order_by(FraudEvent.created_at.desc()).limit(window).all()
        for e in fraud_db:
            try:
                reasons = json.loads(e.reasons_jsonb) if e.reasons_jsonb else []
            except Exception:
                reasons = []
            events.append({
                "id": f"f_{e.id}",
                "type": "fraud",
                "target": f"Txn: ${e.amount}",
                "score": e.final_score,
                "verdict": e.verdict,
                "reasons": reasons,
                "tier": "critical" if "FRAUD" in (e.verdict or "") else "high" if "REVIEW" in (e.verdict or "") else "moderate" if "MODERATE" in (e.verdict or "") else "safe",
                "created_at": e.created_at
            })
            
    # Merge both feeds newest-first, then take the requested page.
    events.sort(key=lambda x: x["created_at"], reverse=True)
    paginated_events = events[offset : offset + limit]
    
    return {
        "events": paginated_events,
        "total": total
    }

@router.delete("/events", status_code=204)
def clear_events(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete all events for the current user."""
    db.query(PhishingEvent).filter(PhishingEvent.user_id == user.id).delete()
    db.query(FraudEvent).filter(FraudEvent.user_id == user.id).delete()
    db.commit()
    return
