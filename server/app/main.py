import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import settings
from app.features.phishing.phishing_ml import warm_model

# Use uvicorn's logger so startup warnings are always visible in server output.
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ephemeral_secret:
        logger.warning("SECRET_KEY not set: using an ephemeral key (sessions reset on restart). "
                       "Set SECRET_KEY in server/.env; it is required when ENVIRONMENT=production.")
    # Load the ML model before serving traffic so the first scan is not slow.
    status = warm_model()
    if status.get("source") != "artifact":
        logger.warning("Phishing model running in fallback mode: %s", status.get("fallback_reason"))
    yield

app = FastAPI(title="Baitlock AI Backend - Enterprise DDD", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.get("/")
def home():
    return {"message": "Hello from Baitlock Backend"}

# Include routers under /api/v1 prefix
app.include_router(api_router, prefix="/api/v1")
