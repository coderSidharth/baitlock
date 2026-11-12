from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from app.core.database import Base
from app.common.time import utc_now

class PhishingEvent(Base):
    __tablename__ = "phishing_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    input_url = Column(String, index=True)
    cache_key = Column(String(64), index=True, nullable=True)
    input_text = Column(String, nullable=True)
    final_score = Column(Float)
    verdict = Column(String)
    reasons_jsonb = Column(String) 
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)

class UserWhitelist(Base):
    __tablename__ = "user_whitelists"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    domain = Column(String, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)

    __table_args__ = (
        Index("ix_user_whitelist_user_domain", "user_id", "domain", unique=True),
    )

class UserBlocklist(Base):
    __tablename__ = "user_blocklists"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    domain = Column(String, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)

    __table_args__ = (
        Index("ix_user_blocklist_user_domain", "user_id", "domain", unique=True),
    )

