from pydantic import BaseModel, HttpUrl
from datetime import datetime
from typing import Optional

class CompanyFlagCreate(BaseModel):
    url: str
    flag_type: str # 'malicious' or 'legitimate'

class CompanyFlagOut(BaseModel):
    id: int
    domain: str
    flag_type: str
    user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
