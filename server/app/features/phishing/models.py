from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from app.core.database import Base
from datetime import datetime

class PhishingEvent(Base):
    __tablename__ = "phishing_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    input_url = Column(String, index=True)
    input_text = Column(String, nullable=True)
    final_score = Column(Float)
    verdict = Column(String)
    reasons_jsonb = Column(String) 
    created_at = Column(DateTime, default=datetime.utcnow)

class UserWhitelist(Base):
    __tablename__ = "user_whitelists"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    domain = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserBlocklist(Base):
    __tablename__ = "user_blocklists"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    domain = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
