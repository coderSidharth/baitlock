import os
import pickle
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score
from .features import extract_url_features

# Global model instance
_model = None
MODEL_PATH = Path(__file__).parent / "phishing_rf_model.pkl"

# Curated dataset representing Tranco / Alexa top legitimate domains
TRANCO_TOP_LEGITIMATE_URLS = [
    "https://google.com",
    "https://www.google.com/search?q=cybersecurity",
    "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://facebook.com/profile",
    "https://amazon.com/products/electronics",
    "https://wikipedia.org/wiki/Phishing",
    "https://github.com/torvalds/linux",
    "https://microsoft.com/en-us/windows",
    "https://apple.com/iphone",
    "https://linkedin.com/feed",
    "https://netflix.com/browse",
    "https://reddit.com/r/netsec",
    "https://twitter.com/home",
    "https://stackoverflow.com/questions/tagged/python",
    "https://cloudflare.com/learning/access-management/what-is-phishing/",
    "https://nytimes.com/section/technology",
    "https://bbc.com/news/technology",
    "https://mozilla.org/en-US/firefox/new/",
    "https://dropbox.com/home",
    "https://spotify.com/us/premium",
    "https://paypal.com/signin",
    "https://chase.com",
    "https://wellsfargo.com",
    "https://bankofamerica.com",
    "https://stripe.com/docs",
    "https://python.org/downloads",
    "https://pypi.org/project/scikit-learn",
    "https://news.ycombinator.com",
    "https://medium.com/topic/cybersecurity",
    "https://gitlab.com/explore",
    "https://docker.com/products/docker-desktop",
    "https://slack.com",
    "https://zoom.us/join",
    "https://adobe.com/creativecloud.html",
    "https://salesforce.com",
    "https://oracle.com/cloud",
    "https://ibm.com/security",
    "https://cisco.com",
    "https://mit.edu",
    "https://stanford.edu",
]

# Curated dataset representing real-world feeds (PhishTank, OpenPhish, URLhaus)
PHISHTANK_OPENPHISH_URLS = [
    # Typosquats & deceptive impersonation
    "http://secure-login-paypa1.com.update.php",
    "http://login-update-account.pw",
    "http://paypal.com.evil.xyz/login",
    "http://appleid.apple.com.secure.login.verify-now.net",
    "http://netflix-support-auth.com-verify.info",
    "http://accounts-google-verify.security-alert.top",
    "http://amaz0n-security-update.club/signin",
    "http://chase-online-banking-security.pw/verify",
    "http://wellsfargo-account-locked.site/auth",
    "http://bankofamerica-fraud-prevention.online/login",
    "http://dhl-express-tracking-delivery.vip/package",
    "http://fedex-parcel-reschedule.click/update",
    # IP-based direct phishing URLs (URLhaus)
    "http://192.168.1.1/login",
    "http://185.220.101.5/sec/bank/index.html",
    "http://45.142.166.112/auth/login.php",
    "http://194.26.29.11/secure/verification",
    "http://103.251.167.20/signin",
    # Free/Abused TLD phishing (.tk, .ml, .ga, .cf, .gq)
    "http://secure-paypal-payment.tk",
    "http://login-google-drive.ml/share",
    "http://steam-community-free-skins.ga/trade",
    "http://apple-icloud-findmydevice.cf/map",
    "http://bank-verification-login.gq/auth",
    # Punycode homograph attacks
    "http://xn--pple-43d.com/login",
    "http://xn--gogle-qoa.com/verify",
    # Deep subdomain deception
    "http://login.apple.com.secure.verify.account.status.net/auth",
    "http://signin.ebay.com.account-update.order-status.xyz/confirm",
    "http://support.microsoft.com.security-alert-391.top/help",
    "http://billing.netflix.com.update-payment-info.site/customer",
    # High-entropy credential harvesters
    "http://x82k9-secure-auth-381.top/login.html",
    "http://q91zk8a77-verify-identity.pw/portal",
    "http://a88172-meta-security-review.xyz/confirm",
    "http://update-secure-auth.com",
    "http://free-prize-claim.xyz",
    "http://cdn-static-res.ru/c2/payload",
    "http://login-verify-account.tk",
    "http://wallet-connect-ledger.click/sync",
    "http://metamask-security-alert.top/seed",
    "http://binance-kyc-update.vip/login",
    "http://coinbase-fraud-alert.pw/verify",
    "http://irs-tax-refund-claim.site/form",
]

def train_and_evaluate_model():
    """
    Extracts features for legitimate and phishing datasets,
    evaluates performance on a held-out test split,
    and returns a fitted RandomForestClassifier model.
    """
    np.random.seed(42)
    X = []
    y = []

    for url in TRANCO_TOP_LEGITIMATE_URLS:
        feats = extract_url_features(url)
        X.append(list(feats.values()))
        y.append(0)  # 0 = Safe

    for url in PHISHTANK_OPENPHISH_URLS:
        feats = extract_url_features(url)
        X.append(list(feats.values()))
        y.append(1)  # 1 = Phishing

    X = np.array(X)
    y = np.array(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10)
    model.fit(X_train, y_train)

    # Evaluate on held-out set
    y_pred = model.predict(X_test)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)

    print(f"[ML Model] Layer 2 Classifier Trained — Held-out Evaluation:")
    print(f"           Precision: {prec:.4f} | Recall: {rec:.4f} | F1: {f1:.4f}")

    try:
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model, f)
    except Exception as e:
        print(f"[ML Model] Warning: Unable to cache model to {MODEL_PATH}: {e}")

    return model

def get_trained_model():
    """
    Returns a trained Random Forest model.
    Loads from disk cache if available, otherwise trains and persists.
    """
    global _model
    if _model is not None:
        return _model

    if MODEL_PATH.exists():
        try:
            with open(MODEL_PATH, "rb") as f:
                _model = pickle.load(f)
                return _model
        except Exception:
            pass

    _model = train_and_evaluate_model()
    return _model

def predict_phishing_ml(url: str) -> dict:
    """
    Predicts if a URL is phishing using the Random Forest model.
    Returns the score (0-100 where 100 is safe, 0 is phishing) and feature contributions.
    """
    model = get_trained_model()
    features_dict = extract_url_features(url)
    features_array = [list(features_dict.values())]
    
    # Predict probability of class 1 (phishing)
    proba = model.predict_proba(features_array)[0]
    # Handle models trained on a single class
    if proba.shape[0] > 1:
        prob = proba[1]
    else:
        prob = proba[0] if model.classes_[0] == 1 else 1 - proba[0]
    
    # Feature contributions for explainable AI telemetry
    reasons = []
    if features_dict['num_hyphens'] > 2:
        reasons.append("High number of hyphens in domain")
    if features_dict['has_ip'] == 1:
        reasons.append("URL contains an IP address instead of a domain name")
    if features_dict['brand_impersonation_score'] <= 2:
        reasons.append("Domain name is suspiciously similar to a known brand")
    if features_dict['embedded_brand'] == 1 and features_dict['exact_brand_match'] == 0:
        reasons.append("A known brand name is deceptively embedded inside the domain")
    if features_dict['domain_entropy'] > 3.8:
        reasons.append("Unusually high character entropy in domain (random-looking string)")
    if features_dict['has_https'] == 0:
        reasons.append("Insecure HTTP transport")
    if features_dict.get('suspicious_tld'):
        reasons.append("Domain uses a suspicious TLD commonly associated with phishing")
    if features_dict.get('has_punycode'):
        reasons.append("Domain uses Punycode (possible homograph attack)")
    if features_dict.get('num_subdomains', 0) >= 3:
        reasons.append("Excessive subdomain nesting")

    # Lower threshold to 0.40 — for a security tool, missing phishing is worse than a false alarm
    score = int((1.0 - prob) * 100)
    # Bias toward detection: if prob >= 0.40, treat as phishing unless it's a verified legitimate brand
    is_legit_brand = (
        features_dict.get('exact_brand_match') == 1 
        and features_dict.get('embedded_brand') == 0 
        and not features_dict.get('suspicious_tld') 
        and not features_dict.get('has_punycode')
    )
    if is_legit_brand:
        score = max(score, 90)
    elif prob >= 0.40:
        score = min(score, 45)

    return {
        "ml_score": score,
        "ml_reasons": reasons
    }
