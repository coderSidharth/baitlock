from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.core.database import Base

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
