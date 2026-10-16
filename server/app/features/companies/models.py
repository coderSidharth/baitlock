from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.core.database import Base

class CompanyFlag(Base):
    __tablename__ = "company_flags"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, index=True, nullable=False)
    flag_type = Column(String, nullable=False) # 'malicious' or 'legitimate'
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
