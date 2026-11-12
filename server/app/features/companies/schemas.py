from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, Literal

class CompanyFlagCreate(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    flag_type: Literal["malicious", "legitimate"] # 'malicious' or 'legitimate'

class CompanyFlagOut(BaseModel):
    id: int
    domain: str
    flag_type: str
    user_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
