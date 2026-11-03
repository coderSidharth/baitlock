"""
Layer-2 phishing classifier (URL-lexical model).

The production model is trained offline by `train.py` on a large public
dataset (see scripts/build_dataset.py) and shipped as a versioned bundle:

    {
      "model": <sklearn classifier with predict_proba>,
      "feature_names": [...],   # must equal features.FEATURE_NAMES
      "version": "2.x.y",
      "trained_at": ISO-8601,
      "metrics": {...},         # held-out evaluation, see model_card.json
    }

At load time the bundle's feature schema is validated against the running
feature extractor. If the artifact is missing, unreadable, or was trained on a
different schema, a small fallback model is fitted from the curated reference
URLs so the service keeps working, and /health reports the degraded state.
"""

from __future__ import annotations

import logging
import pickle
import threading
from pathlib import Path

import numpy as np
from threadpoolctl import ThreadpoolController

from .features import FEATURE_NAMES, extract_url_features
from .reference_urls import BENIGN_REFERENCE, PHISHING_REFERENCE

logger = logging.getLogger("baitlock.ml")

MODEL_PATH = Path(__file__).parent / "phishing_url_model.pkl"

# Backwards-compatible aliases (older imports / scripts).
TRANCO_TOP_LEGITIMATE_URLS = BENIGN_REFERENCE
PHISHTANK_OPENPHISH_URLS = PHISHING_REFERENCE

_lock = threading.Lock()
_bundle: dict | None = None

# Single-URL inference runs inside web-server worker threads. Letting OpenMP
# spin up a parallel thread team there costs ~70 ms per call; one row needs no
# parallelism. Batch training is unaffected (it does not go through _predict).
_threadpools: ThreadpoolController | None = None


def _predict(model, x):
    global _threadpools
    if _threadpools is None:
        # Must be created lazily: a controller only sees native libraries that are
        # already loaded, and scikit-learn's OpenMP runtime is loaded when the model
        # is unpickled. Created at import time, the limit would silently do nothing.
        _threadpools = ThreadpoolController()
    with _threadpools.limit(limits=1, user_api="openmp"):
        return model.predict_proba(x)


def _vectorize(urls):
    rows = []
    for u in urls:
        f = extract_url_features(u)
        rows.append([f[n] for n in FEATURE_NAMES])
    return np.asarray(rows, dtype=float)


def _fallback_bundle(reason: str) -> dict:
    """Fit a small model from the curated reference sets (degraded mode)."""
    from sklearn.ensemble import RandomForestClassifier

    logger.warning("ML model artifact unavailable (%s); using fallback model.", reason)
    X = _vectorize(BENIGN_REFERENCE + PHISHING_REFERENCE)
    y = np.array([0] * len(BENIGN_REFERENCE) + [1] * len(PHISHING_REFERENCE))
    clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    clf.fit(X, y)
    return {
        "model": clf,
        "feature_names": list(FEATURE_NAMES),
        "version": "fallback",
        "trained_at": None,
        "metrics": {},
        "source": "fallback",
        "fallback_reason": reason,
    }


def _load_bundle(path: Path = MODEL_PATH) -> dict:
    if not path.exists():
        return _fallback_bundle(f"{path.name} not found")
    try:
        with open(path, "rb") as f:
            obj = pickle.load(f)
    except Exception as e:  # corrupt / incompatible pickle
        return _fallback_bundle(f"could not load {path.name}: {e}")

    if not isinstance(obj, dict) or "model" not in obj:
        return _fallback_bundle("legacy artifact without a feature schema")
    if list(obj.get("feature_names", [])) != list(FEATURE_NAMES):
        return _fallback_bundle("feature schema mismatch; retrain with train.py")

    obj.setdefault("source", "artifact")
    logger.info("Loaded phishing model v%s (trained %s).", obj.get("version"), obj.get("trained_at"))
    return obj


def get_trained_model():
    """Return the loaded classifier (lazy, thread-safe)."""
    return _get_bundle()["model"]


def _get_bundle() -> dict:
    global _bundle
    if _bundle is None:
        with _lock:
            if _bundle is None:
                _bundle = _load_bundle()
    return _bundle


def warm_model() -> dict:
    """Load the model eagerly (call at application startup)."""
    b = _get_bundle()
    # One dummy prediction to initialise any lazy internals.
    _predict(b["model"], _vectorize(["https://example.com"]))
    return model_status()


def model_status() -> dict:
    b = _bundle
    if b is None:
        return {"loaded": False}
    return {
        "loaded": True,
        "source": b.get("source"),
        "version": b.get("version"),
        "trained_at": b.get("trained_at"),
        "n_features": len(b.get("feature_names", [])),
        **({"fallback_reason": b["fallback_reason"]} if b.get("fallback_reason") else {}),
    }


def reload_model(path: Path = MODEL_PATH) -> dict:
    """Hot-swap the model artifact (e.g. after retraining)."""
    global _bundle
    new = _load_bundle(path)
    with _lock:
        _bundle = new
    return model_status()


def predict_phishing_ml(url: str) -> dict:
    """
    Score a URL with the Layer-2 model.
    Returns ml_score in 0-100 (100 = safe, 0 = phishing) plus human-readable reasons.
    """
    bundle = _get_bundle()
    f = extract_url_features(url)
    x = np.asarray([[f[n] for n in FEATURE_NAMES]], dtype=float)
    prob = float(_predict(bundle["model"], x)[0][1])

    reasons = []
    if f["has_ip"]:
        reasons.append("URL contains an IP address instead of a domain name")
    if f["brand_impersonation_score"] <= 2:
        reasons.append("Domain name is suspiciously similar to a known brand")
    if f["embedded_brand"] and not f["exact_brand_match"]:
        reasons.append("A known brand name is deceptively embedded inside the domain")
    if f["num_hyphens_host"] > 2:
        reasons.append("High number of hyphens in domain")
    if f["host_entropy"] > 3.8:
        reasons.append("Unusually high character entropy in domain (random-looking string)")
    if f["free_hosting"] and prob >= 0.5:
        reasons.append("Hosted on a free hosting platform commonly abused for phishing")
    if f["is_shortener"]:
        reasons.append("URL shortener hides the real destination")
    if f["has_punycode"]:
        reasons.append("Internationalised (punycode) domain can disguise look-alike characters")
    if f["suspicious_keyword_count"] >= 3 and prob >= 0.5:
        reasons.append("Multiple credential-harvesting keywords in the URL")

    return {
        "ml_score": int(round((1.0 - prob) * 100)),
        "ml_probability": round(prob, 4),
        "ml_reasons": reasons,
    }
