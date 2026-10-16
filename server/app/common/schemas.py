from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator

RiskTier = Literal["safe", "moderate", "high", "critical"]
Verdict = Literal["SAFE", "LEGITIMATE", "MODERATE_RISK", "REVIEW_NEEDED", "HIGH_RISK", "CRITICAL_RISK", "FRAUD"]

class ScoreBreakdown(BaseModel):
    rule_score: int = Field(ge=0, le=100, description="Deterministic rule engine score (0-100)")
    ml_score: int = Field(ge=0, le=100, description="ML model score (0-100)")
    llm_score: int = Field(default=0, ge=0, le=100, description="LLM analysis score (0-100), only for phishing with text")

    @field_validator("rule_score", "ml_score", "llm_score", mode="before")
    @classmethod
    def clamp_sub_scores(cls, v: int) -> int:
        if isinstance(v, (int, float)):
            return max(0, min(100, int(v)))
        return v

    model_config = {"frozen": True}

class ScoreResult(BaseModel):
    score: int = Field(ge=0, le=100, description="Final fused risk score (0-100)", alias="final_score")
    verdict: str = Field(description="Human-readable risk verdict")
    tier: RiskTier = Field(description="Risk tier: safe | moderate | high | critical")
    reasons: list[str] = Field(default_factory=list, description="Explanation strings for the score")
    breakdown: ScoreBreakdown = Field(description="Individual component score breakdown")

    @field_validator("score", mode="before")
    @classmethod
    def clamp_score(cls, v: int) -> int:
        if isinstance(v, (int, float)):
            return max(0, min(100, int(v)))
        return v

    @field_validator("reasons", mode="before")
    @classmethod
    def deduplicate_reasons(cls, v: list[str]) -> list[str]:
        if isinstance(v, list):
            seen: set[str] = set()
            unique: list[str] = []
            for r in v:
                if r not in seen:
                    seen.add(r)
                    unique.append(r)
            return unique
        return v

    @model_validator(mode="after")
    def tier_matches_score(self) -> "ScoreResult":
        expected_tier = _score_to_tier(self.score)
        if self.tier != expected_tier:
            pass
        return self

    model_config = {"frozen": True, "populate_by_name": True, "serialize_by_alias": True}

def _score_to_tier(score: int) -> RiskTier:
    """Map a 0-100 safety score to a risk tier.
    Higher score = safer. Lower score = more dangerous.
    Matches the logic in phishing/service.py:
      < 25  -> critical
      < 50  -> high
      < 75  -> moderate
      >= 75 -> safe
    """
    if score < 25: return "critical"
    elif score < 50: return "high"
    elif score < 75: return "moderate"
    else: return "safe"
