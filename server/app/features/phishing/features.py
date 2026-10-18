import math
import re
from urllib.parse import urlparse
import jellyfish
import tldextract

# Top targeted brands for quick Levenshtein matching and embedding detection
TOP_BRANDS = [
    "paypal", "apple", "microsoft", "netflix", "amazon", "google", 
    "facebook", "bankofamerica", "chase", "wellsfargo", "dhl", "fedex",
    "icloud", "yahoo", "linkedin", "instagram", "whatsapp", "twitter"
]

def shannon_entropy(s: str) -> float:
    """Calculates the Shannon entropy of a string."""
    if not s:
        return 0.0
    prob = [float(s.count(c)) / len(s) for c in dict.fromkeys(list(s))]
    entropy = -sum([p * math.log(p) / math.log(2.0) for p in prob])
    return entropy

def extract_url_features(url: str) -> dict:
    """
    Extracts lexical and structural features from a URL to feed into the ML model.
    """
    features = {}
    
    # 1. Structural features with scheme and domain normalization
    normalized_url = url if "://" in url else f"http://{url}"
    parsed = urlparse(normalized_url)
    domain = (parsed.hostname or parsed.netloc or "").split(':')[0].lower()
    path = parsed.path
    
    features['url_length'] = len(url)
    features['domain_length'] = len(domain)
    features['path_length'] = len(path)
    
    # 2. Character counts and presence (focusing on domain to avoid penalizing query strings)
    features['num_dots'] = domain.count('.')
    features['num_hyphens'] = domain.count('-')
    features['num_at'] = url.count('@')
    features['num_digits'] = sum(c.isdigit() for c in domain)
    features['has_https'] = 1 if url.startswith("https://") else 0
    features['has_ip'] = 1 if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', domain) else 0
    
    # 3. Complexity features
    features['entropy'] = shannon_entropy(url)
    features['domain_entropy'] = shannon_entropy(domain)
    
    # 4. Brand impersonation using tldextract for accurate registered domain comparison
    min_dist = float('inf')
    brand_match = 0 # 1 if legit exact match, 0 if not
    embedded_brand = 0 # 1 if brand is deceptively embedded
    
    ext = tldextract.extract(normalized_url)
    registered_domain = ext.domain.lower()  # e.g. "paypal" from "www.paypal.com"
    domain_lower = domain.lower()

    for brand in TOP_BRANDS:
        # Check if the registered domain IS the brand (e.g. paypal.com, apple.co.uk)
        if registered_domain == brand:
            brand_match = 1
            continue
             
        # Check for deceptive embedding (e.g. br-icloud.com.br, netflix-support.com)
        # Only flag if the registered domain is NOT the brand itself
        if brand in domain_lower and registered_domain != brand:
            embedded_brand = 1
            
        # Check for typosquatting on full domain and sub-tokens (e.g. paypa1.com or paypa1-security.com)
        dist = jellyfish.levenshtein_distance(brand, registered_domain)
        if dist < min_dist:
            min_dist = dist
        for part in re.split(r'[-_.]', registered_domain):
            if len(part) >= 3:
                part_dist = jellyfish.levenshtein_distance(brand, part)
                if part_dist < min_dist:
                    min_dist = part_dist
                    
    # Exact brand matches are not impersonations (score 100 = safe)
    if brand_match == 1:
        features['brand_impersonation_score'] = 100
    else:
        features['brand_impersonation_score'] = min_dist if min_dist != float('inf') else 100
    features['exact_brand_match'] = brand_match
    features['embedded_brand'] = embedded_brand
    
    return features
