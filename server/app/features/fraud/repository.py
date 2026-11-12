from sqlalchemy.orm import Session
from app.features.fraud.models import FraudEvent
import json
import logging

logger = logging.getLogger(__name__)

class FraudRepository:
    def create(self, db: Session, txn: dict, result: dict, user_id: int = None):
        db_event = FraudEvent(
            amount=txn["amount"],
            velocity=txn["velocity"],
            hour=txn["hour"],
            geo_distance=txn["geo_distance"],
            final_score=result["final_score"],
            verdict=result["verdict"],
            reasons_jsonb=json.dumps(result["reasons"]),
            user_id=user_id
        )
        db.add(db_event)
        try:
            db.commit()
            db.refresh(db_event)
        except Exception:
            db.rollback()
            logger.exception("Failed to persist fraud event")
            raise
        return db_event

fraud_repo = FraudRepository()
