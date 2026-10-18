from sqlalchemy.orm import Session
from app.features.phishing.models import PhishingEvent
from urllib.parse import urlparse
import json

class PhishingRepository:
    def create(self, db: Session, url: str, text: str, result: dict, user_id: int = None):
        # Strip query strings and fragments for user privacy (no credentials, tokens, or PII in DB)
        try:
            parsed = urlparse(url)
            clean_url = parsed._replace(query="", fragment="").geturl()
        except Exception:
            clean_url = url

        # Page text is never persisted to plaintext DB to protect user privacy (banking, email, personal sessions)
        db_event = PhishingEvent(
            input_url=clean_url,
            input_text=None,
            final_score=result["final_score"],
            verdict=result["verdict"],
            reasons_jsonb=json.dumps(result["reasons"]),
            user_id=user_id
        )
        try:
            db.add(db_event)
            db.commit()
            db.refresh(db_event)
        except Exception as e:
            db.rollback()
            print(f"Error saving phishing event to DB: {e}")
        return db_event

phishing_repo = PhishingRepository()
