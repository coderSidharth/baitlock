from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, func
from app.core.database import Base

class CompanyFlag(Base):
    __tablename__ = "company_flags"
    __table_args__ = (
        UniqueConstraint("user_id", "domain", "flag_type", name="uq_user_domain_flag"),
    )

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, index=True, nullable=False)
    flag_type = Column(String, nullable=False) # 'malicious' or 'legitimate'
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
