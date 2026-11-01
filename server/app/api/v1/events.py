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
    """Retrieve recent events for the dashboard live feed."""
    events: List[Dict[str, Any]] = []
    
    if type is None or type == "phishing":
        phishing_db = db.query(PhishingEvent).filter(
            PhishingEvent.user_id == user.id
        ).order_by(PhishingEvent.created_at.desc()).offset(offset).limit(limit).all()
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
        fraud_db = db.query(FraudEvent).filter(
            FraudEvent.user_id == user.id
        ).order_by(FraudEvent.created_at.desc()).offset(offset).limit(limit).all()
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
            
    # Sort combined events by created_at descending
    events.sort(key=lambda x: x["created_at"], reverse=True)
    
    # Paginate
    paginated_events = events[offset : offset + limit]
    
    return {
        "events": paginated_events,
        "total": len(events)
    }
