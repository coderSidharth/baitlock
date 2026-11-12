import json
import hashlib
import hmac
from app.core.config import settings
import logging
import re
from urllib.parse import unquote, urlsplit, urlunsplit

from sqlalchemy.orm import Session

from app.features.phishing.models import PhishingEvent

logger = logging.getLogger(__name__)
_SENSITIVE_PATH_MARKER = re.compile(
    r"(?:reset|recover|token|auth|verify|verification|password|session|invite|code|key|secret|confirm)",
    re.IGNORECASE,
)
_LONG_TOKEN_SEGMENT = re.compile(r"^(?=.{24,}$)(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]+$")


def sanitize_url_for_storage(url: str) -> str:
    """Keep useful host/path context while dropping credentials and likely secrets."""
    try:
        parsed = urlsplit(url)
        host = parsed.hostname
        if not host or parsed.scheme.lower() not in {"http", "https"}:
            return "<invalid-url>"
        if ":" in host:
            host = f"[{host}]"
        port = parsed.port
        netloc = f"{host}:{port}" if port is not None else host

        segments = parsed.path.split("/")
        redact_next = False
        for index in range(1, len(segments)):
            decoded_segment = unquote(segments[index])
            if redact_next or _LONG_TOKEN_SEGMENT.fullmatch(decoded_segment):
                segments[index] = "[redacted]"
                redact_next = False
            else:
                redact_next = bool(_SENSITIVE_PATH_MARKER.search(decoded_segment))

        return urlunsplit((parsed.scheme, netloc, "/".join(segments), "", ""))
    except (TypeError, ValueError):
        return "<invalid-url>"


def cache_key_for_url(url: str) -> str:
    # HMAC prevents recovering sensitive URL query parameters from cache keys.
    return hmac.new(settings.SECRET_KEY.encode(), url.encode(), hashlib.sha256).hexdigest()


class PhishingRepository:
    def create(self, db: Session, url: str, text: str, result: dict, user_id: int = None, cacheable: bool = False):
        # Page text and URL secrets are excluded from persistent telemetry.
        db_event = PhishingEvent(
            input_url=sanitize_url_for_storage(url),
            input_text=None,
            cache_key=cache_key_for_url(url) if cacheable else None,
            final_score=result["final_score"],
            verdict=result["verdict"],
            reasons_jsonb=json.dumps(result["reasons"]),
            user_id=user_id,
        )
        try:
            db.add(db_event)
            db.commit()
            db.refresh(db_event)
        except Exception as e:
            db.rollback()
            logger.warning("Failed to save phishing event (%s)", type(e).__name__)
        return db_event


phishing_repo = PhishingRepository()
