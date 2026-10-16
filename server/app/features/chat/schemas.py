from pydantic import BaseModel
from datetime import datetime
from typing import List

class ChatMessageBase(BaseModel):
    role: str
    content: str

class ChatMessageCreate(ChatMessageBase):
    pass

class ChatMessageOut(ChatMessageBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessageOut]
