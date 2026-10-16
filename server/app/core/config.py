import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Baitlock AI Backend"
    # Using SQLite for development. Production would be postgresql://...
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./events.db")
    
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # JWT Config
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-for-development-only")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
