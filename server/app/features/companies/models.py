from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Index, func
from app.core.database import Base

class CompanyFlag(Base):
    __tablename__ = "company_flags"
    __table_args__ = (
        Index("uq_user_domain_vote", "user_id", "domain", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, index=True, nullable=False)
    flag_type = Column(String, nullable=False) # 'malicious' or 'legitimate'
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
