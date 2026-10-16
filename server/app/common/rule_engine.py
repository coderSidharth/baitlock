import re
from urllib.parse import urlparse

# Suspicious TLDs often used for phishing
SUSPICIOUS_TLDS = {'.top', '.xyz', '.club', '.online', '.site', '.click', '.pw', '.vip'}

def rule_check_phishing(url: str) -> dict:
    """
    Deterministic rules for quick phishing detection.
    Returns a score (0-100) and rules triggered.
    """
    score = 100
    reasons = []
    
    parsed = urlparse(url)
    domain = parsed.netloc
    
    if not url.startswith("https://"):
        score -= 20
        reasons.append("URL does not use secure HTTPS protocol")
        
    # Check suspicious TLD
    for tld in SUSPICIOUS_TLDS:
        if domain.endswith(tld):
            score -= 40
            reasons.append(f"Domain uses a suspicious TLD ({tld})")
            break
            
    # Check for direct IP
    if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', domain):
        score -= 50
        reasons.append("URL uses an IP address instead of a domain name")
        
    # Check for excessive subdomains (e.g., login.apple.com.secure.verify.net)
    if domain.count('.') > 3:
        score -= 30
        reasons.append("URL has an unusually high number of subdomains")
        
    # Check for hidden characters / punycode (e.g., xn--)
    if "xn--" in domain:
        score -= 40
        reasons.append("Domain uses Punycode (often used in homograph attacks)")
        
    score = max(score, 0)
    
    return {
        "rule_score": score,
        "rule_reasons": reasons
    }

def rule_check_transaction(amount: float, velocity: int, hour: int, geo_distance: float) -> dict:
    """
    Deterministic rules for quick fraud detection.
    """
    score = 100
    reasons = []
    
    if amount > 10000:
        score -= 40
        reasons.append("Transaction amount exceeds hard limit ($10,000)")
        
    if velocity > 20:
        score -= 50
        reasons.append("Extremely high transaction frequency")
        
    if geo_distance > 5000:
        score -= 50
        reasons.append("Impossible travel distance (geo-velocity rule)")
        
    score = max(score, 0)
    
    return {
        "rule_score": score,
        "rule_reasons": reasons
    }
