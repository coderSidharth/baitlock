import numpy as np
from sklearn.ensemble import RandomForestClassifier
from .features import extract_url_features

# Global mock model
_model = None

def get_trained_model():
    """
    Returns a trained Random Forest model. 
    If it doesn't exist, it trains one instantly on synthetic data.
    """
    global _model
    if _model is not None:
        return _model

    # Generate synthetic training data for the hackathon demo
    # We create some "good" URLs and some "phishing" URLs
    # Features match order in extract_url_features: 
    # [length, domain_length, path_length, dots, hyphens, at, digits, https, ip, entropy, domain_entropy, impersonation, exact_brand, embedded_brand]
    
    X_train = []
    y_train = []
    
    # 1. Good URLs
    good_urls = [
        "https://google.com",
        "https://github.com/microsoft/vscode",
        "https://amazon.com/products/123",
        "https://en.wikipedia.org/wiki/Machine_learning"
    ]
    for url in good_urls:
        feats = extract_url_features(url)
        X_train.append(list(feats.values()))
        y_train.append(0) # 0 = safe
        
    # 2. Phishing URLs
    phish_urls = [
        "http://secure-login-paypa1.com.update.php",
        "http://192.168.1.1/login",
        "https://netflix-support-auth.com-verify.info",
        "http://appleid.apple.com.secure.login.verify-now.net"
    ]
    for url in phish_urls:
        feats = extract_url_features(url)
        X_train.append(list(feats.values()))
        y_train.append(1) # 1 = phishing
        
    # Add a bit of noise to make the model robust
    for _ in range(50):
        # random good
        X_train.append([np.random.randint(15, 40), np.random.randint(5, 15), np.random.randint(0, 10), 
                        np.random.randint(1, 3), 0, 0, np.random.randint(0, 5), 1, 0, 
                        np.random.uniform(2.5, 3.5), np.random.uniform(2.0, 3.0), 100, 1, 0])
        y_train.append(0)
        # random bad
        X_train.append([np.random.randint(40, 100), np.random.randint(15, 30), np.random.randint(5, 30), 
                        np.random.randint(3, 8), np.random.randint(1, 5), np.random.randint(0, 2), np.random.randint(5, 20), 0, np.random.randint(0, 2), 
                        np.random.uniform(3.5, 5.0), np.random.uniform(3.0, 4.5), np.random.randint(1, 4), 0, 1])
        y_train.append(1)

    _model = RandomForestClassifier(n_estimators=50, random_state=42)
    _model.fit(X_train, y_train)
    return _model

def predict_phishing_ml(url: str) -> dict:
    """
    Predicts if a URL is phishing using the Random Forest model.
    Returns the score (0-100) and feature contributions.
    """
    model = get_trained_model()
    features_dict = extract_url_features(url)
    features_array = [list(features_dict.values())]
    
    # Predict probability of class 1 (phishing)
    prob = model.predict_proba(features_array)[0][1]
    
    # Hacky "feature contribution" without SHAP for speed:
    # We look at standard deviations from mean (not true SHAP, but works for explainability demo)
    reasons = []
    if features_dict['num_hyphens'] > 2:
        reasons.append("High number of hyphens in domain")
    if features_dict['has_ip'] == 1:
        reasons.append("URL contains an IP address instead of a domain name")
    if features_dict['brand_impersonation_score'] <= 2:
        reasons.append("Domain name is suspiciously similar to a known brand")
    if features_dict['embedded_brand'] == 1 and features_dict['exact_brand_match'] == 0:
        reasons.append("A known brand name is deceptively embedded inside the domain")
    if features_dict['domain_entropy'] > 4.0:
        reasons.append("Unusually high character entropy in domain (random-looking string)")
        
    return {
        "ml_score": int((1.0 - prob) * 100),
        "ml_reasons": reasons
    }
