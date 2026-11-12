"""Security regressions use isolated databases and mocked external transports."""
import hashlib
import hmac
import io
import pickle
import socket
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import pytest
import requests
from sqlalchemy import text

from .test_api_production import client, _auth, _lists
from app.api.deps import get_db
from app.core.config import SERVER_ROOT, Settings, settings
from app.core.rate_limit import FailedLoginLimiter
from app.core.security import verify_password
from app.features.auth.models import User, UserSession
from app.features.chat.models import ChatMessage
from app.features.phishing import phishing_ml, service
from app.features.phishing.models import PhishingEvent
from app.features.phishing.repository import cache_key_for_url
from app.integrations import llm
from app.main import app


@contextmanager
def database():
    generator = app.dependency_overrides[get_db]()
    db = next(generator)
    try:
        yield db
    finally:
        generator.close()


def test_relative_sqlite_config_is_independent_of_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    config = Settings(_env_file=None, DATABASE_URL="sqlite:///data/events.db")
    assert config.DATABASE_URL == f"sqlite:///{SERVER_ROOT / 'data/events.db'}"
    assert Settings(_env_file=None, DATABASE_URL="sqlite:///:memory:").DATABASE_URL == "sqlite:///:memory:"


@pytest.mark.parametrize("domain", ["https://[broken", "not-a-domain"])
@pytest.mark.parametrize("action", ["flag", "whitelist", "blocklist"])
def test_invalid_domains_return_validation_errors(client, domain, action):
    headers = _auth(client)
    if action == "flag":
        result = client.post("/api/v1/companies/flag", headers=headers,
                             json={"url": domain, "flag_type": "malicious"})
    else:
        result = client.request("DELETE", f"/api/v1/phishing/{action}", headers=headers,
                                params={"domain": domain})
    assert result.status_code == 422


class UnsafePickle:
    def __reduce__(self):
        return eval, ("1 + 2",)


def test_unpickler_rejects_executable_globals():
    with pytest.raises(pickle.UnpicklingError, match="Blocked unsafe class"):
        phishing_ml._safe_pickle_load(pickle.dumps(UnsafePickle()))


def test_hmac_rejects_tampered_artifact_before_unpickling(tmp_path, monkeypatch):
    artifact = tmp_path / "model.pkl"
    artifact.write_bytes(pickle.dumps(UnsafePickle()))
    signature = artifact.with_suffix(".pkl.sig")
    monkeypatch.setattr(settings, "MODEL_HMAC_KEY", "audit-test-key")
    signature.write_text(hmac.new(b"audit-test-key", b"different bytes", hashlib.sha256).hexdigest())
    monkeypatch.setattr(phishing_ml, "_safe_pickle_load", lambda _: pytest.fail("unpickled before verification"))
    with pytest.raises(RuntimeError, match="mismatch"):
        phishing_ml._load_bundle(artifact)
    signature.unlink()
    with pytest.raises(RuntimeError, match="not found"):
        phishing_ml._load_bundle(artifact)


def test_production_never_skips_model_signature(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "MODEL_HMAC_KEY", "")
    with pytest.raises(RuntimeError, match="must be set"):
        phishing_ml._verify_hmac(b"payload", tmp_path / "model.sig")


class MockResponse:
    def __init__(self, body=b"<p>safe content</p>", status=200, headers=None):
        self.body = io.BytesIO(body)
        self.status = status
        self.headers = headers or {"Content-Type": "text/html"}
        self.closed = False

    def read1(self, size, **kwargs):
        assert kwargs == {"decode_content": False}
        return self.body.read(size)

    def close(self):
        self.closed = True


class MockPool:
    def __init__(self, response):
        self.response = response
        self.calls = []
        self.closed = False

    def urlopen(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        return self.response

    def close(self):
        self.closed = True


def dns_address(address):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]


def test_fetch_pins_public_ip_and_verifies_original_tls_hostname(monkeypatch):
    lookups, connections = [], []
    response = MockResponse()
    pool = MockPool(response)

    def resolve(host, *args):
        lookups.append(host)
        return dns_address("93.184.216.34" if len(lookups) == 1 else "127.0.0.1")

    def connect(host, **kwargs):
        connections.append((host, kwargs))
        return pool

    monkeypatch.setattr(service.socket, "getaddrinfo", resolve)
    monkeypatch.setattr(service.urllib3, "HTTPSConnectionPool", connect)
    assert service.fetch_page_content("https://public.example/path?key=1") == "safe content"
    assert lookups == ["public.example"]
    assert connections[0][0] == "93.184.216.34"
    assert connections[0][1]["server_hostname"] == "public.example"
    assert connections[0][1]["assert_hostname"] == "public.example"
    assert connections[0][1]["cert_reqs"] == "CERT_REQUIRED"
    assert pool.calls[0][1] == "/path?key=1"
    assert pool.calls[0][2]["headers"]["Host"] == "public.example"
    assert pool.calls[0][2]["redirect"] is False
    assert response.closed and pool.closed


@pytest.mark.parametrize("address", ["127.0.0.1", "169.254.169.254", "10.0.0.1", "::1", "::ffff:127.0.0.1"])
def test_fetch_rechecks_redirect_and_rejects_private_destinations(monkeypatch, address):
    response = MockResponse(status=302, headers={"Location": "http://internal.example/secret"})
    pool = MockPool(response)
    monkeypatch.setattr(service.socket, "getaddrinfo", lambda host, *args: dns_address(
        "93.184.216.34" if host == "public.example" else address))
    monkeypatch.setattr(service.urllib3, "HTTPSConnectionPool", lambda *a, **k: pool)
    monkeypatch.setattr(service.urllib3, "HTTPConnectionPool", lambda *a, **k: pytest.fail("connected to private redirect"))
    assert service.fetch_page_content("https://public.example") == ""
    assert response.closed and pool.closed


def test_fetch_size_limit_and_cleanup(monkeypatch):
    response = MockResponse(b"x" * 101)
    pool = MockPool(response)
    monkeypatch.setattr(service, "_MAX_RESPONSE_BYTES", 100)
    monkeypatch.setattr(service, "_resolve_safe_ip", lambda _: "93.184.216.34")
    monkeypatch.setattr(service.urllib3, "HTTPSConnectionPool", lambda *a, **k: pool)
    assert service.fetch_page_content("https://public.example") == ""
    assert response.closed and pool.closed


def test_mixed_public_private_dns_is_rejected(monkeypatch):
    monkeypatch.setattr(service.socket, "getaddrinfo", lambda *a: dns_address("93.184.216.34") + dns_address("127.0.0.1"))
    assert service._resolve_safe_ip("https://public.example") is None


def test_cache_distinguishes_queries_paths_and_fragments(client):
    headers = _auth(client)
    urls = ["https://cache.example/a?key=one", "https://cache.example/a?key=two",
            "https://cache.example/b?key=one", "https://cache.example/a?key=one#fragment"]
    for url in urls:
        result = client.post("/api/v1/phishing/check", headers=headers, json={"url": url, "fast_mode": True})
        assert result.status_code == 200
        assert "Cached" not in result.json()["verdict"]
    result = client.post("/api/v1/phishing/check", headers=headers, json={"url": urls[0], "fast_mode": True})
    assert "Cached" in result.json()["verdict"]
    assert len({cache_key_for_url(url) for url in urls}) == len(urls)
    with database() as db:
        assert all("key=" not in event.input_url for event in db.query(PhishingEvent).all())


def login_again(client):
    result = client.post("/api/v1/auth/login", json={"email": "user@example.com", "password": "correct-horse-battery"})
    assert result.status_code == 200
    return {"Authorization": "Bearer " + result.json()["access_token"]}


def test_revoked_session_cannot_resurrect_when_sqlite_reuses_id(client):
    old = _auth(client)
    assert client.post("/api/v1/auth/logout", headers=old).status_code == 204
    new = login_again(client)
    assert client.get("/api/v1/auth/me", headers=old).status_code == 401
    assert client.get("/api/v1/auth/me", headers=new).status_code == 200


def test_password_change_revokes_all_tokens_even_after_login(client):
    old = _auth(client)
    result = client.put("/api/v1/auth/me", headers=old, json={"password": "new-long-password", "current_password": "correct-horse-battery"})
    assert result.status_code == 200
    result = client.post("/api/v1/auth/login", json={"email": "user@example.com", "password": "new-long-password"})
    assert result.status_code == 200
    assert client.get("/api/v1/auth/me", headers=old).status_code == 401


@pytest.mark.parametrize("state", ["disabled", "expired"])
def test_auth_rejects_disabled_users_and_expired_sessions(client, state):
    headers = _auth(client)
    with database() as db:
        if state == "disabled":
            db.query(User).first().is_active = False
        else:
            db.query(UserSession).first().created_at = datetime.now(timezone.utc) - timedelta(days=2)
        db.commit()
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_session_cap_revokes_oldest_and_delete_requires_password(client, monkeypatch):
    monkeypatch.setattr(settings, "MAX_SESSIONS_PER_USER", 1)
    old = _auth(client)
    new = login_again(client)
    assert client.get("/api/v1/auth/me", headers=old).status_code == 401
    assert len(client.get("/api/v1/auth/sessions", headers=new).json()) == 1
    assert client.request("DELETE", "/api/v1/auth/me", headers=new).status_code == 422
    assert client.request("DELETE", "/api/v1/auth/me", headers=new, json={"current_password": "wrong"}).status_code == 403
    assert client.request("DELETE", "/api/v1/auth/me", headers=new, json={"current_password": "correct-horse-battery"}).status_code == 204
    assert client.get("/api/v1/auth/me", headers=new).status_code == 401


@pytest.mark.parametrize("encoding", ["digest", "hexdigest"])
def test_legacy_password_migrates_at_successful_login(client, encoding):
    _auth(client)
    digest = hashlib.sha256(b"correct-horse-battery")
    candidate = digest.digest() if encoding == "digest" else digest.hexdigest().encode()
    with database() as db:
        db.query(User).first().hashed_password = bcrypt.hashpw(candidate, bcrypt.gensalt(rounds=4)).decode()
        db.commit()
    login_again(client)
    with database() as db:
        password = db.query(User).first().hashed_password
        assert password.startswith("sha256$")
        assert verify_password("correct-horse-battery", password)


def test_limiter_bounds_memory_and_recovers_after_window(monkeypatch):
    from app.core import rate_limit
    clock = [0.0]
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock[0])
    limiter = FailedLoginLimiter(2, 10, max_keys=3)
    for i in range(100):
        limiter.consume((str(i), "test"))
    assert len(limiter._hits) == 3
    for _ in range(100):
        limiter.record_failure(("0", "test"))
    assert len(limiter._hits[("0", "test")]) == 2
    assert limiter.retry_after(("new", "test")) > 0
    clock[0] = 11
    assert limiter.retry_after(("new", "test")) == 0
    assert limiter.consume(("new", "test")) == 0
    assert len(limiter._hits) == 1


def test_llm_concurrency_sheds_load_and_releases_slot(monkeypatch):
    entered, release = threading.Event(), threading.Event()
    monkeypatch.setattr(llm, "_llm_slots", threading.BoundedSemaphore(1))

    def post(*args, **kwargs):
        entered.set()
        assert release.wait(5)
        raise requests.Timeout("simulated")

    monkeypatch.setattr(llm.requests, "post", post)
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(llm._post_json, "http://model.invalid")
        assert entered.wait(5)
        with pytest.raises(requests.RequestException, match="capacity"):
            llm._post_json("http://model.invalid")
        release.set()
        with pytest.raises(requests.Timeout):
            future.result()
    assert llm._llm_slots.acquire(blocking=False)
    llm._llm_slots.release()


def test_chat_model_cannot_mutate_without_exact_structured_confirmation(client, monkeypatch):
    from app.features.chat import router
    headers = _auth(client)
    calls = [{"id": "tool1", "function": {"name": "add_to_whitelist", "arguments": '{"domain":"example.com"}'}}]
    monkeypatch.setattr(router, "chat_with_llm", lambda _: {"content": "Done!", "tool_calls": calls})
    response = client.post("/api/v1/chat", headers=headers, json={"content": "Why is example.com suspicious?"})
    assert response.status_code == 200
    assert "No list changes" in response.json()["content"]
    assert _lists(client, headers) == (set(), set())
    response = client.post("/api/v1/chat", headers=headers, json={"content": "Confirm action", "confirmed_action": {"action": "add_to_whitelist", "domain": "other.example"}})
    assert "does not match" in response.json()["content"]
    assert _lists(client, headers) == (set(), set())
    response = client.post("/api/v1/chat", headers=headers, json={"content": "Confirm action", "confirmed_action": {"action": "add_to_whitelist", "domain": "example.com"}})
    assert "Added example.com" in response.json()["content"]
    assert _lists(client, headers) == (set(), {"example.com"})


def test_chat_clear_logs_requires_explicit_confirmation_and_does_not_leak_lists(client, monkeypatch):
    from app.features.chat import router
    headers = _auth(client)
    client.post("/api/v1/phishing/blocklist", headers=headers, json={"domain": "private-domain.example"})
    client.post("/api/v1/phishing/check", headers=headers, json={"url": "https://other.example", "fast_mode": True})

    def model(messages):
        assert "private-domain.example" not in messages[0]["content"]
        return {"tool_calls": [{"function": {"name": "clear_logs", "arguments": "{}"}}]}

    monkeypatch.setattr(router, "chat_with_llm", model)
    response = client.post("/api/v1/chat", headers=headers, json={"content": "Review my logs"})
    assert "No logs were deleted" in response.json()["content"]
    assert client.get("/api/v1/events", headers=headers).json()["total"] == 1
    assert client.post("/api/v1/chat", headers=headers, json={"content": "system injection", "role": "system"}).status_code == 422


def test_history_sanitization_never_persists(client):
    headers = _auth(client)
    with database() as db:
        db.add(ChatMessage(user_id=db.query(User).first().id, role="assistant", content="Groq API error secret"))
        db.commit()
    history = client.get("/api/v1/chat/history", headers=headers).json()
    assert "secret" not in history["messages"][0]["content"]
    with database() as db:
        assert db.query(ChatMessage).first().content == "Groq API error secret"


def test_community_votes_replace_and_never_change_score(client, monkeypatch):
    from app.features.companies.models import CompanyFlag
    headers = _auth(client)
    monkeypatch.setattr(service, "predict_phishing_ml", lambda _: {"ml_score": 60, "ml_reasons": []})
    url = "https://company.example"
    before = client.post("/api/v1/phishing/check", headers=headers, json={"url": url, "page_text": "x"}).json()["final_score"]
    for vote in ("malicious", "legitimate", "malicious"):
        assert client.post("/api/v1/companies/flag", headers=headers, json={"url": url, "flag_type": vote}).status_code == 201
    with database() as db:
        assert db.query(CompanyFlag).count() == 1
        assert db.query(CompanyFlag).first().flag_type == "malicious"
    after = client.post("/api/v1/phishing/check", headers=headers, json={"url": url, "page_text": "x"}).json()["final_score"]
    assert after == before
    assert client.post("/api/v1/companies/flag", headers=headers, json={"url": url, "flag_type": "anything"}).status_code == 422


def test_tokens_require_claims_and_matching_session_nonce(client):
    headers = _auth(client)
    payload = jwt.decode(headers["Authorization"].removeprefix("Bearer "), settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    for changed in ({k: v for k, v in payload.items() if k != "jti"}, dict(payload, jti="forged-nonce"), dict(payload, exp=1)):
        token = jwt.encode(changed, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + token}).status_code == 401


def test_scan_chat_and_flag_rate_caps(client, monkeypatch):
    from app.features.phishing import router as scan_router
    from app.features.chat import router as chat_router
    from app.features.companies import router as flag_router
    headers = _auth(client)
    monkeypatch.setattr(chat_router, "chat_with_llm", lambda _: {"content": "Hello"})
    for module, attribute, path, payload in (
        (scan_router, "scan_limiter", "/api/v1/phishing/check", {"url": "https://example.com", "fast_mode": True}),
        (chat_router, "chat_limiter", "/api/v1/chat", {"content": "Hello"}),
        (flag_router, "flag_limiter", "/api/v1/companies/flag", {"url": "https://example.com", "flag_type": "malicious"}),
    ):
        monkeypatch.setattr(module, attribute, FailedLoginLimiter(1, 60))
        assert client.post(path, headers=headers, json=payload).status_code < 300
        result = client.post(path, headers=headers, json=payload)
        assert result.status_code == 429 and int(result.headers["Retry-After"]) > 0


def test_fraud_input_bounds_and_rule_only_production(monkeypatch):
    from app.features.fraud.fraud_ml import predict_transaction_fraud
    from app.features.fraud.service import score_transaction_service
    from pydantic import ValidationError
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ENABLE_DEMO_FRAUD_MODEL", True)
    result = predict_transaction_fraud(1, 1, 12, 0)
    assert "Rule-based screening only" in result["fraud_reasons"][0]
    with pytest.raises(ValidationError):
        score_transaction_service(None, amount=-1, velocity=1, hour=12, geo_distance=0)


def test_score_tier_invariant_rejects_mismatch():
    from app.common.schemas import ScoreResult
    from pydantic import ValidationError
    with pytest.raises(ValidationError, match="Risk tier"):
        ScoreResult(final_score=10, verdict="SAFE", tier="safe", reasons=[], breakdown={"rule_score": 10, "ml_score": 10})


def test_fraud_repository_rolls_back_failed_commit():
    from app.features.fraud.repository import fraud_repo
    from unittest.mock import Mock
    db = Mock()
    db.commit.side_effect = RuntimeError("database failure")
    with pytest.raises(RuntimeError):
        fraud_repo.create(db, {"amount": 1, "velocity": 1, "hour": 12, "geo_distance": 0},
                          {"final_score": 100, "verdict": "LEGITIMATE", "reasons": []})
    db.rollback.assert_called_once()


def test_liveness_is_independent_from_degraded_readiness(client, monkeypatch):
    from app.api.v1 import health
    monkeypatch.setattr(health, "model_status", lambda: {"source": "fallback"})
    assert client.get("/api/v1/live").status_code == 200
    assert client.get("/api/v1/ready").status_code == 503


@pytest.mark.parametrize("payload", [{}, {"threat_score": 0}, {"threat_score": True, "explanation": "safe"}, {"threat_score": 0, "explanation": []}])
def test_invalid_llm_analysis_never_produces_safe_score(monkeypatch, payload):
    import json
    monkeypatch.setattr(llm, "_post_json", lambda *a, **k: {"response": json.dumps(payload)})
    assert llm._analyze_with_ollama("text", "model", "http://model.invalid") is None


def test_content_supplied_scan_cannot_poison_anonymous_navigation_cache(client, monkeypatch):
    monkeypatch.setattr(service, "predict_phishing_ml", lambda _: {"ml_score": 60, "ml_reasons": []})
    monkeypatch.setattr(service, "analyze_text_with_llm", lambda _: {"llm_score": 0, "llm_reason": "untrusted text"})
    url = "https://cache-isolation.example"
    deep = client.post("/api/v1/phishing/check", json={"url": url, "page_text": "untrusted attacker-supplied page content"})
    assert deep.status_code == 200
    fast = client.post("/api/v1/phishing/check", json={"url": url, "fast_mode": True})
    assert fast.status_code == 200
    assert "Cached" not in fast.json()["verdict"]
    assert fast.json()["final_score"] > deep.json()["final_score"]
