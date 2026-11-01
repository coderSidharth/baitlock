from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from app.core.database import Base
from datetime import datetime, timezone

def _utc_now():
    return datetime.now(timezone.utc)

class FraudEvent(Base):
    __tablename__ = "fraud_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    amount = Column(Float)
    velocity = Column(Integer)
    hour = Column(Integer)
    geo_distance = Column(Float)
    final_score = Column(Float)
    verdict = Column(String)
    reasons_jsonb = Column(String)
    created_at = Column(DateTime(timezone=True), default=_utc_now, index=True)
