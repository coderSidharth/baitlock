from typing import Annotated, Optional
from pydantic import BaseModel, Field, field_validator
from app.common.schemas import ScoreResult

class PhishingCheckRequest(BaseModel):
    url: Annotated[str, Field(min_length=1, max_length=2048, description="The URL to analyze for phishing indicators")]
    page_text: Optional[str] = Field(default=None, max_length=50_000, description="Optional page body text")
    fast_mode: bool = Field(default=False, description="Skip LLM analysis for fast background scanning")

    @field_validator("url", mode="before")
    @classmethod
    def normalize_url(cls, v: str) -> str:
        if isinstance(v, str): v = v.strip()
        if not v: raise ValueError("URL must not be empty")
        return v

    @field_validator("url", mode="after")
    @classmethod
    def validate_url_scheme(cls, v: str) -> str:
        if not any(v.lower().startswith(s) for s in ("http://", "https://", "ftp://")):
            raise ValueError("URL must start with a valid scheme (http://, https://, or ftp://)")
        return v

    @field_validator("page_text", mode="before")
    @classmethod
    def strip_page_text(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            v = v.strip()
            return v if v else None
        return v

    model_config = {"str_strip_whitespace": True}

class PhishingScoreResponse(ScoreResult):
    pass

class WhitelistRequest(BaseModel):
    domain: str = Field(min_length=1, max_length=255, description="Domain to whitelist")
