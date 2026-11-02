from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
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
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Hello from Baitlock Backend"}

# Include routers under /api/v1 prefix
app.include_router(api_router, prefix="/api/v1")
