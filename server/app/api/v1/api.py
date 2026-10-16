from fastapi import APIRouter
from app.features.phishing.router import router as phishing_router
from app.features.fraud.router import router as fraud_router
from app.features.auth.router import router as auth_router
from app.features.chat.router import router as chat_router
from app.api.v1.health import router as health_router
from app.api.v1.events import router as events_router
from app.features.companies.router import router as companies_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(events_router)
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(phishing_router, prefix="/phishing", tags=["phishing"])
api_router.include_router(fraud_router, prefix="/fraud", tags=["fraud"])
api_router.include_router(companies_router, prefix="/companies", tags=["companies"])
