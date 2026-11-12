import logging
import secrets
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parents[2]

from pydantic import PrivateAttr, Field, field_validator
from sqlalchemy.engine import make_url
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("baitlock.config")

_PLACEHOLDER_SECRETS = {"", "CHANGE_ME_TO_A_RANDOM_SECRET"}


class Settings(BaseSettings):
    """Application settings, read from environment variables and server/.env."""

    PROJECT_NAME: str = "Baitlock AI Backend"
    # "production" turns on strict startup checks (see model_post_init).
    ENVIRONMENT: str = "development"

    # SQLite for development; use postgresql://... in production.
    DATABASE_URL: str = f"sqlite:///{SERVER_ROOT / 'events.db'}"

    LLM_PROVIDER: str = "ollama"
    OLLAMA_MODEL: str = "llama3.1:8b"
    OLLAMA_URL: str = "http://localhost:11434/api/generate"
    OLLAMA_CHAT_URL: str = "http://localhost:11434/api/chat"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"

    # JWT signing key. MUST be a stable, strong secret in production: a random
    # per-process key invalidates tokens on restart and across workers.
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, ge=5, le=1440)  # Re-authenticate after one hour.
    MAX_SESSIONS_PER_USER: int = Field(default=10, ge=1, le=100)
    ENABLE_DEMO_FRAUD_MODEL: bool = False
    LLM_MAX_CONCURRENT: int = Field(default=4, ge=1, le=8)
    LLM_TIMEOUT_SECONDS: int = Field(default=8, ge=1, le=15)

    # Comma-separated list of web origins allowed to call the API (the dashboard).
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # HMAC key for verifying ML model artifact integrity.
    # If empty in dev, signature verification is skipped with a warning.
    MODEL_HMAC_KEY: str = ""

    # Brute-force protection for /auth/login (failed attempts per window).
    LOGIN_RATE_LIMIT: int = Field(default=10, ge=1, le=1000)
    LOGIN_RATE_WINDOW_SECONDS: int = Field(default=900, ge=1, le=86400)

    model_config = SettingsConfigDict(env_file=SERVER_ROOT / ".env", env_file_encoding="utf-8", extra="ignore")

    _ephemeral_secret: bool = PrivateAttr(default=False)

    @field_validator("DATABASE_URL")
    @classmethod
    def absolute_sqlite_path(cls, value: str) -> str:
        url = make_url(value)
        if url.get_backend_name() == "sqlite" and url.database not in (None, "", ":memory:"):
            if not Path(url.database).is_absolute():
                url = url.set(database=str((SERVER_ROOT / url.database).resolve()))
        return url.render_as_string(hide_password=False)

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in {"production", "prod"}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def ephemeral_secret(self) -> bool:
        return self._ephemeral_secret

    def model_post_init(self, __context) -> None:
        if self.SECRET_KEY in _PLACEHOLDER_SECRETS:
            if self.is_production:
                raise RuntimeError(
                    "SECRET_KEY is not set. In production it must be a strong, stable secret "
                    "Generate a stable secret with secrets.token_urlsafe(64)."
                )
            # Development convenience: an ephemeral key (tokens reset on restart).
            self.SECRET_KEY = secrets.token_urlsafe(64)
            self._ephemeral_secret = True
        elif len(self.SECRET_KEY) < 32:
            if self.is_production:
                raise RuntimeError("SECRET_KEY must be at least 32 characters in production.")
            logger.warning("SECRET_KEY is shorter than 32 characters; use a stronger key.")

        if self.is_production and "*" in self.cors_origins:
            raise RuntimeError("ALLOWED_ORIGINS must not contain '*' in production (credentials are enabled).")


settings = Settings()
