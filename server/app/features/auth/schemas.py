from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = Field(default=None, max_length=200)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=1024, description="Password must be at least 8 characters long")

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=200)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=1024, description="Password must be at least 8 characters long")
    current_password: Optional[str] = Field(default=None, max_length=1024)

    @model_validator(mode="after")
    def require_current_password(self):
        if self.password is not None and not self.current_password:
            raise ValueError("Current password is required to change password")
        if self.email:
            self.email = self.email.lower()
        return self

class UserDeleteConfirm(BaseModel):
    """Requires password re-verification to delete an account."""
    current_password: str = Field(..., min_length=1, max_length=1024, description="Current password required to confirm account deletion")

class UserOut(UserBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class UserSessionOut(BaseModel):
    id: int
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
