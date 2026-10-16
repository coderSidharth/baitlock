from typing import Annotated
from pydantic import BaseModel, Field, field_validator, model_validator
from app.common.schemas import ScoreResult

class Transaction(BaseModel):
    amount: Annotated[float, Field(gt=0, le=1_000_000, description="Transaction amount in USD (max $1,000,000)")]
    velocity: Annotated[int, Field(ge=0, le=1000, description="Number of transactions in the last hour")]
    hour: Annotated[int, Field(ge=0, le=23, description="Hour of day the transaction occurred (0-23)")]
    geo_distance: Annotated[float, Field(ge=0, le=40_075, description="Distance in km (max ≈ Earth circumference)")]

    @field_validator("amount", "geo_distance", mode="before")
    @classmethod
    def coerce_numbers(cls, v: float) -> float:
        if isinstance(v, (int, float)):
            v = float(v)
            if v != v: raise ValueError("Must be a valid number, not NaN")
        return v

    @model_validator(mode="after")
    def flag_impossible_velocity(self) -> "Transaction":
        if self.velocity > 500 and self.amount > 100_000:
            raise ValueError("Implausible combination: >500 txn/hr with >$100k amount")
        return self

class FraudScoreRequest(BaseModel):
    transaction: Transaction

class FraudScoreResponse(ScoreResult):
    pass
