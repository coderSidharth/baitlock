from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.database import engine, Base

# Import all models so Base.metadata is aware of them for table creation
from app.features.phishing import models as phishing_models
from app.features.fraud import models as fraud_models
from app.features.auth import models as auth_models
from app.features.chat import models as chat_models
from app.features.companies import models as companies_models

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically create missing database tables on application startup
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Baitlock AI Backend - Enterprise DDD", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Hello from Baitlock Backend"}

# Include routers under /api/v1 prefix as well as root level for maximum compatibility
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router)
