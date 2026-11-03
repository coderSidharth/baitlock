from fastapi import APIRouter, Depends
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
    }
