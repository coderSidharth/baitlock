import math
import re
from urllib.parse import urlparse
import jellyfish

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
    
    # 1. Structural features
    parsed = urlparse(url)
    domain = parsed.netloc
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
    
    # 4. Brand impersonation
    # Catch both Typosquatting (paypa1 vs paypal) and Embedded Brands (br-icloud.com)
    min_dist = float('inf')
    brand_match = 0 # 1 if legit exact match, 0 if not
    embedded_brand = 0 # 1 if brand is deceptively embedded
    
    domain_lower = domain.lower()
    
    # We strip common TLDs for distance comparison to catch paypa1.com -> paypa1
    domain_base = domain_lower
    for tld in ['.com', '.org', '.net', '.co', '.info', '.biz', '.br', '.uk']:
        if domain_base.endswith(tld):
            domain_base = domain_base[:-len(tld)]

    for brand in TOP_BRANDS:
        # Check if it's the legit brand domain (e.g. apple.com or apple.co.uk)
        if domain_lower == f"{brand}.com" or domain_lower.startswith(f"{brand}."):
             brand_match = 1
             continue
             
        # Check for deceptive embedding (e.g. br-icloud.com.br, netflix-support.com)
        if brand in domain_lower:
            embedded_brand = 1
            
        # Check for typosquatting (e.g. paypa1.com -> paypa1 vs paypal)
        dist = jellyfish.levenshtein_distance(brand, domain_base)
        if dist < min_dist:
            min_dist = dist
                    
    features['brand_impersonation_score'] = min_dist if min_dist != float('inf') else 100
    features['exact_brand_match'] = brand_match
    features['embedded_brand'] = embedded_brand
    
    return features
