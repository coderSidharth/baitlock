from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import List, Literal

class ChatMessageBase(BaseModel):
    role: str = "user"
    content: str = Field(min_length=1, max_length=8000)

class ConfirmedListAction(BaseModel):
    action: Literal["add_to_whitelist", "remove_from_whitelist", "add_to_blocklist", "remove_from_blocklist"]
    domain: str = Field(min_length=1, max_length=255)


class ChatMessageCreate(ChatMessageBase):
    role: Literal["user"] = "user"
    confirm_clear_logs: bool = False
    confirmed_action: ConfirmedListAction | None = None

class ChatMessageOut(ChatMessageBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessageOut]
