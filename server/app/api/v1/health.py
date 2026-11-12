from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.core.config import settings
from app.features.phishing.phishing_ml import model_status

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Liveness, database connectivity and ML model status."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    ml = model_status()
    healthy = db_status == "connected" and ml.get("source") == "artifact"
    return {
        "status": "healthy" if healthy else "degraded",
        "app": settings.PROJECT_NAME,
        "database": db_status,
        "ml_model": ml,
        "fraud_detection": "rules-only" if settings.is_production or not settings.ENABLE_DEMO_FRAUD_MODEL else "synthetic-demo",
    }


@router.get("/live")
def liveness():
    return {"status": "alive"}


@router.get("/ready")
def readiness(response: Response, db: Session = Depends(get_db)):
    result = health_check(db)
    if result["status"] != "healthy":
        response.status_code = 503
    return result
