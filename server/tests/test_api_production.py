"""
API-level production tests: run the real FastAPI app against an isolated
in-memory database. Covers overrides, the fast-path cache, model loading,
detection quality on reference URLs, rate limiting and pagination.

    uv run --with pytest python -m pytest -q tests
"""

import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parent.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.features.auth.models  # noqa: F401,E402
import app.features.chat.models  # noqa: F401,E402
import app.features.companies.models  # noqa: F401,E402
import app.features.fraud.models  # noqa: F401,E402
import app.features.phishing.models  # noqa: F401,E402
from app.api.deps import get_db  # noqa: E402
from app.core.database import Base  # noqa: E402
from app.features.auth import router as auth_router  # noqa: E402
from app.features.phishing import phishing_ml  # noqa: E402
from app.features.phishing.features import FEATURE_NAMES, extract_url_features  # noqa: E402
from app.features.phishing.reference_urls import BENIGN_REFERENCE, PHISHING_REFERENCE  # noqa: E402
from app.features.phishing.reputation import domain_reputation  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def _get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    auth_router.login_limiter._hits.clear()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    engine.dispose()


def _auth(client, email="user@example.com", password="correct-horse-battery"):
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    r = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _lists(client, h):
    b = {x["domain"] for x in client.get("/api/v1/phishing/blocklist", headers=h).json()["blocklist"]}
    w = {x["domain"] for x in client.get("/api/v1/phishing/whitelist", headers=h).json()["whitelist"]}
    return b, w


# --------------------------------------------------------------------------- #
# Overrides: whitelist and blocklist are mutually exclusive
# --------------------------------------------------------------------------- #
def test_whitelisting_removes_domain_from_blocklist(client):
    h = _auth(client)
    client.post("/api/v1/phishing/blocklist", json={"domain": "https://Shady-Shop.example/cart"}, headers=h)
    assert _lists(client, h) == ({"shady-shop.example"}, set())

    client.post("/api/v1/phishing/whitelist", json={"domain": "shady-shop.example"}, headers=h)
    assert _lists(client, h) == (set(), {"shady-shop.example"})

    r = client.post("/api/v1/phishing/check", json={"url": "https://shady-shop.example/cart", "fast_mode": True}, headers=h)
    assert r.json()["tier"] == "safe"


def test_blocklisting_removes_domain_from_whitelist(client):
    h = _auth(client)
    client.post("/api/v1/phishing/whitelist", json={"domain": "intranet.example"}, headers=h)
    client.post("/api/v1/phishing/blocklist", json={"domain": "intranet.example"}, headers=h)
    assert _lists(client, h) == ({"intranet.example"}, set())
    r = client.post("/api/v1/phishing/check", json={"url": "https://intranet.example/", "fast_mode": True}, headers=h)
    assert r.json()["tier"] == "critical"


# --------------------------------------------------------------------------- #
# Fast-path cache
# --------------------------------------------------------------------------- #
def test_unblocked_site_is_not_replayed_from_cache(client):
    """After removing a blocklist entry, the cached BLOCKED verdict must not keep blocking."""
    h = _auth(client)
    url = "https://careers.acme-widgets.com/jobs/123"
    client.post("/api/v1/phishing/blocklist", json={"domain": "careers.acme-widgets.com"}, headers=h)
    r = client.post("/api/v1/phishing/check", json={"url": url, "fast_mode": True}, headers=h)
    assert "User Blocklist" in r.json()["verdict"]

    client.request("DELETE", "/api/v1/phishing/blocklist", json={"domain": "careers.acme-widgets.com"}, headers=h)
    r = client.post("/api/v1/phishing/check", json={"url": url, "fast_mode": True}, headers=h)
    assert "User Blocklist" not in r.json()["verdict"]


def test_cache_requires_exact_host(client):
    """A verdict cached for paypay.com.evil-login.xyz must not be reused for pay.com."""
    h = _auth(client)
    bad = client.post("/api/v1/phishing/check",
                      json={"url": "http://paypay.com.evil-login.xyz/signin", "fast_mode": True}, headers=h).json()
    assert bad["tier"] in ("high", "critical")
    other = client.post("/api/v1/phishing/check", json={"url": "https://pay.com/", "fast_mode": True}, headers=h).json()
    assert "(Cached)" not in other["verdict"]


# --------------------------------------------------------------------------- #
# Model artifact + detection quality
# --------------------------------------------------------------------------- #
def test_shipped_model_artifact_loads_with_matching_schema():
    status = phishing_ml.reload_model()
    assert status["source"] == "artifact", status
    assert status["n_features"] == len(FEATURE_NAMES)
    assert list(extract_url_features("https://example.com").keys()) == FEATURE_NAMES


def test_incompatible_artifact_falls_back_safely(tmp_path):
    bad = tmp_path / "legacy.pkl"
    import pickle
    pickle.dump({"model": object(), "feature_names": ["old_feature"]}, open(bad, "wb"))
    try:
        status = phishing_ml.reload_model(bad)
        assert status["source"] == "fallback"
        assert 0 <= phishing_ml.predict_phishing_ml("https://example.com")["ml_score"] <= 100
    finally:
        phishing_ml.reload_model()


def test_reference_detection_end_to_end(client):
    """Fast-path verdicts the extension acts on: block phishing, don't block real sites."""
    h = _auth(client)
    blocked = lambda r: r["tier"] in ("high", "critical")  # noqa: E731
    phishing_hits = sum(
        blocked(client.post("/api/v1/phishing/check", json={"url": u, "fast_mode": True}, headers=h).json())
        for u in PHISHING_REFERENCE)
    benign_blocked = [u for u in BENIGN_REFERENCE
                      if blocked(client.post("/api/v1/phishing/check", json={"url": u, "fast_mode": True}, headers=h).json())]
    assert phishing_hits / len(PHISHING_REFERENCE) >= 0.95
    assert len(benign_blocked) / len(BENIGN_REFERENCE) <= 0.03, benign_blocked


def test_brand_features_resist_common_false_matches():
    assert extract_url_features("https://purchase-helper.com/cart")["embedded_brand"] == 0   # "chase"
    assert extract_url_features("https://pineapple-recipes.com/")["embedded_brand"] == 0     # "apple"
    assert extract_url_features("https://roblox.com.zm/games/1")["brand_wrong_tld"] == 1
    assert extract_url_features("https://login.microsoftonline.com/x")["exact_brand_match"] == 1
    # "www." is not a risk signal
    a = extract_url_features("https://www.example-shop.com/login")
    b = extract_url_features("https://example-shop.com/login")
    assert a == b


def test_reputation_excludes_user_content_platforms():
    assert domain_reputation("www.paypal.com")["trusted"]
    assert not domain_reputation("docs.google.com")["trusted"]
    assert not domain_reputation("attacker.github.io")["trusted"]
    assert not domain_reputation("evil.sharepoint.com")["trusted"]
    assert not domain_reputation("www.notion.so")["trusted"]


# --------------------------------------------------------------------------- #
# Auth hardening + API behaviour
# --------------------------------------------------------------------------- #
def test_login_rate_limited_after_repeated_failures(client):
    client.post("/api/v1/auth/register", json={"email": "victim@example.com", "password": "correct-horse-battery"})
    codes = [client.post("/api/v1/auth/login", data={"username": "victim@example.com", "password": "nope"}).status_code
             for _ in range(auth_router.login_limiter.limit + 1)]
    assert codes[:-1] == [401] * auth_router.login_limiter.limit
    assert codes[-1] == 429
    # Even the right password is refused while locked out.
    r = client.post("/api/v1/auth/login", data={"username": "victim@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_events_pagination_merges_newest_first(client):
    h = _auth(client)
    for i in range(7):
        client.post("/api/v1/phishing/check", json={"url": f"https://site{i}.example.org/", "fast_mode": True}, headers=h)
    for amount in (10, 20, 30):
        client.post("/api/v1/fraud/score", json={"transaction": {"amount": amount, "velocity": 1, "hour": 12, "geo_distance": 1}}, headers=h)
    page1 = client.get("/api/v1/events?limit=4&offset=0", headers=h).json()
    page2 = client.get("/api/v1/events?limit=4&offset=4", headers=h).json()
    allev = client.get("/api/v1/events?limit=100", headers=h).json()
    assert page1["total"] == page2["total"] == allev["total"] == 10
    ids = [e["id"] for e in allev["events"]]
    assert [e["id"] for e in page1["events"]] + [e["id"] for e in page2["events"]] == ids[:8]
    times = [e["created_at"] for e in allev["events"]]
    assert times == sorted(times, reverse=True)


def test_health_reports_model_status(client):
    body = client.get("/api/v1/health").json()
    assert body["database"] == "connected"
    assert body["ml_model"]["loaded"] and body["ml_model"]["source"] == "artifact"
    assert body["status"] == "healthy"


def test_production_requires_strong_secret(monkeypatch):
    from app.core.config import Settings
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "CHANGE_ME_TO_A_RANDOM_SECRET")
    with pytest.raises(RuntimeError):
        Settings(_env_file=None)
    monkeypatch.setenv("SECRET_KEY", "x" * 48)
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://app.example.com")
    s = Settings(_env_file=None)
    assert s.is_production and s.cors_origins == ["https://app.example.com"]


def test_inference_thread_limit_targets_openmp():
    """Single-row inference must cap OpenMP threads (otherwise ~70 ms per scan in
    web-server worker threads). Guards against creating the threadpool controller
    before scikit-learn's OpenMP runtime is loaded, which silently disables the cap."""
    phishing_ml.reload_model()
    phishing_ml.predict_phishing_ml("https://example.com/login")
    apis = {lib["user_api"] for lib in phishing_ml._threadpools.info()}
    assert "openmp" in apis
