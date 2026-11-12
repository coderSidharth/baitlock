import json
import logging
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, cast, func, literal, select, union_all
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.common.schemas import tier_for_verdict
from app.features.auth.models import User
from app.features.phishing.models import PhishingEvent
from app.features.fraud.models import FraudEvent

router = APIRouter(tags=["Events"])
logger = logging.getLogger(__name__)


@router.get("/events")
def list_events(
    type: Literal["phishing", "fraud"] | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    queries = []
    for kind, model, target in (
        ("phishing", PhishingEvent, PhishingEvent.input_url),
        ("fraud", FraudEvent, literal("Txn: $") + cast(FraudEvent.amount, String)),
    ):
        if type is None or type == kind:
            queries.append(select(
                model.id.label("event_id"), literal(kind).label("type"), target.label("target"),
                model.final_score.label("score"), model.verdict, model.reasons_jsonb, model.created_at,
            ).where(model.user_id == user.id))
    feed = union_all(*queries).subquery()
    total = db.scalar(select(func.count()).select_from(feed))
    rows = db.execute(select(feed).order_by(
        feed.c.created_at.desc(), feed.c.type.asc(), feed.c.event_id.desc()
    ).offset(offset).limit(limit)).mappings()
    events = []
    for row in rows:
        event = dict(row)
        try:
            reasons = json.loads(event.pop("reasons_jsonb") or "[]")
            if not isinstance(reasons, list):
                raise ValueError("Expected reasons list")
        except (ValueError, TypeError):
            logger.warning("Invalid stored reasons for event %s", event["event_id"])
            reasons = []
        event["id"] = f"{event['type'][0]}_{event.pop('event_id')}"
        event["reasons"] = reasons
        event["tier"] = tier_for_verdict(event["verdict"], event["score"])
        events.append(event)
    return {"events": events, "total": total}


@router.delete("/events", status_code=204)
def clear_events(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(PhishingEvent).filter(PhishingEvent.user_id == user.id).delete()
    f = db.query(FraudEvent).filter(FraudEvent.user_id == user.id).delete()
    db.commit()
    logger.info("User %s cleared %s security events", user.id, p + f)
