import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Baitlock AI Backend"
    DATABASE_URL: str = "sqlite:///./events.db"

    LLM_PROVIDER: str = "ollama"
    OLLAMA_MODEL: str = "llama3.1:8b"
    OLLAMA_URL: str = "http://localhost:11434/api/generate"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"

    # JWT Config — generate a random key at startup if SECRET_KEY is not set in .env
    SECRET_KEY: str = secrets.token_urlsafe(64)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
