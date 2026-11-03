"""
Lexical / structural URL features for the Layer-2 phishing classifier.

Design notes (production):
  * Scheme-agnostic: features are computed on the scheme-less URL. Transport
    security (HTTP vs HTTPS) is scored by the deterministic rule engine, so the
    model does not learn dataset artefacts about which feeds use which scheme.
  * Stable schema: FEATURE_NAMES is the single source of truth for the feature
    vector order. The trained model bundle stores the names it was trained on
    and the loader refuses a mismatched model.
  * Offline: public-suffix parsing uses tldextract's bundled snapshot, so
    feature extraction never makes a network call.
"""

from __future__ import annotations

import ipaddress
import math
import re
from urllib.parse import urlsplit

import jellyfish
import tldextract

# Use the bundled Public Suffix List snapshot only (no network at request time).
_tld_extract = tldextract.TLDExtract(suffix_list_urls=())

# Frequently impersonated brands.
TOP_BRANDS = [
    "paypal", "apple", "microsoft", "netflix", "amazon", "google", "facebook",
    "bankofamerica", "chase", "wellsfargo", "dhl", "fedex", "icloud", "yahoo",
    "linkedin", "instagram", "whatsapp", "twitter", "office365", "outlook",
    "onedrive", "sharepoint", "adobe", "docusign", "dropbox", "coinbase",
    "binance", "metamask", "blockchain", "steam", "ebay", "walmart", "usps",
    "verizon", "citibank", "hsbc", "barclays", "santander", "americanexpress",
    "mastercard", "spotify", "discord", "telegram", "tiktok", "roblox",
    "booking", "airbnb", "trezor", "ledger", "kraken", "robinhood",
]

# Registered domains owned by the brands above (legitimate brand infrastructure).
# A URL on one of these is treated as an exact brand match, not an impersonation.
BRAND_OWNED_DOMAINS = {
    "googleapis.com", "googleusercontent.com", "gstatic.com", "youtube.com",
    "google.co.uk", "googlesource.com", "withgoogle.com", "goo.gl",
    "microsoftonline.com", "live.com", "office.com", "office365.com",
    "sharepoint.com", "azure.com", "windows.net", "msn.com", "outlook.com",
    "microsoft365.com", "onedrive.com", "skype.com", "bing.com",
    "amazonaws.com", "amazon.co.uk", "amazon.de", "amazon.in", "media-amazon.com",
    "ssl-images-amazon.com", "aws.amazon.com", "primevideo.com",
    "paypalobjects.com", "paypal-community.com", "apple.com", "icloud.com",
    "fbcdn.net", "facebook.net", "messenger.com", "whatsapp.net", "instagram.com",
    "linkedin.com", "licdn.com", "twimg.com", "x.com", "steampowered.com",
    "steamcommunity.com", "steamstatic.com", "ebay.co.uk", "ebayimg.com",
    "dropboxusercontent.com", "docusign.net", "adobelogin.com", "adobe.io",
    "citi.com", "chasecdn.com", "wellsfargomedia.com", "bankofamerica.com",
    "spotifycdn.com", "discordapp.com", "discord.gg", "telegram.org", "t.me",
    "tiktokcdn.com", "rbxcdn.com", "booking.com", "airbnb.co.uk",
    "metamask.io", "ledger.com", "trezor.io", "blockchain.com", "coinbase.com",
}

# Suffixes on which a bare brand label (e.g. "paypal.<suffix>") is plausibly the
# real company. A brand label on any other suffix ("roblox.com.zm",
# "paypal.xyz") is a classic impersonation trick.
OFFICIAL_BRAND_SUFFIXES = {
    "com", "net", "org", "co", "io", "app", "us", "co.uk", "uk", "de", "fr", "ca",
    "com.au", "au", "co.jp", "jp", "in", "co.in", "es", "it", "nl", "se", "ch",
    "com.br", "mx", "com.mx", "pl", "be", "at", "dk", "no", "fi", "ie", "nz",
    "co.nz", "sg", "com.sg", "hk", "com.hk", "kr", "co.kr", "tw", "com.tw",
    "ae", "sa", "com.sa", "tr", "com.tr", "za", "co.za", "ar", "com.ar", "cl",
    "pt", "gr", "cz", "hu", "ro", "il", "co.il",
}

# Soft-signal TLDs that are disproportionately abused (the rule engine keeps
# its own, smaller hard-penalty list).
RISKY_TLDS = {
    "tk", "ml", "ga", "cf", "gq", "top", "xyz", "club", "online", "site",
    "click", "pw", "vip", "icu", "buzz", "cyou", "monster", "rest", "fit",
    "work", "su", "zip", "mov", "lol", "quest", "sbs", "cfd", "bond", "gdn",
    "loan", "men", "win", "kim", "date", "review", "country", "stream",
    "download", "racing", "accountant", "science", "party", "trade", "bid",
    "cricket", "webcam", "ru", "cn",
}

# Fixed top-level-domain vocabulary for the categorical `tld_id` feature
# (derived once from the training data by frequency; 0 = any other TLD).
# Changing this list changes the feature schema -> retrain the model.
TLD_VOCAB = [
    "com", "net", "org", "top", "br", "uk", "ca", "xyz", "ru", "info", "io", "au",
    "tk", "in", "edu", "cn", "de", "pl", "co", "id", "us", "ml", "jp", "it", "ga",
    "shop", "cc", "fr", "eu", "online", "me", "gov", "za", "cl", "live", "cf", "app",
    "gq", "biz", "icu", "vn", "cloud", "nl", "ai", "mx", "click", "ro", "tv", "arpa",
    "es", "buzz", "site", "club", "ar", "be", "ir", "cfd", "vip", "link", "pro", "nz",
    "ch", "cyou", "cz", "ua", "tr", "dev", "pk", "hu", "tech", "gr", "il", "sbs", "my",
    "se", "pt", "kr", "ng", "at", "work", "support", "ke", "life", "mobi", "to", "ph",
    "sg", "tw", "th", "ie", "dk", "ws", "space", "pe", "su", "bond", "pw", "store",
    "ae", "asia", "one", "rs", "np", "fun", "world", "si", "tokyo", "sk", "no",
    "website", "fi", "digital", "services", "by", "kz", "media", "autos", "sa", "hk",
    "art", "ge", "network", "ve", "help", "win", "bar", "hr", "email", "qpon", "fit",
    "lol", "bd", "ink", "uz", "fm", "lk", "is", "ma", "im", "ly", "ltd", "do", "ec",
    "xn--p1ai", "lt", "ee", "sh", "ba", "host", "xin",
]
_TLD_INDEX = {t: i + 1 for i, t in enumerate(TLD_VOCAB)}

SHORTENERS = {
    "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
    "cutt.ly", "rb.gy", "shorturl.at", "tiny.cc", "rebrand.ly", "s.id",
    "t.ly", "bl.ink", "lnkd.in", "shorte.st", "adf.ly", "bitly.com",
}

# Free / user-content hosting commonly abused to host phishing kits.
FREE_HOSTING = {
    "000webhostapp.com", "weebly.com", "wixsite.com", "firebaseapp.com",
    "web.app", "github.io", "netlify.app", "vercel.app", "pages.dev",
    "workers.dev", "blogspot.com", "glitch.me", "repl.co", "herokuapp.com",
    "azurewebsites.net", "appspot.com", "godaddysites.com", "webflow.io",
    "square.site", "yolasite.com", "jimdosite.com", "mystrikingly.com",
    "carrd.co", "ngrok.io", "ngrok-free.app", "r2.dev", "duckdns.org",
    "surge.sh", "framer.app", "my.canva.site", "notion.site", "gitbook.io",
}

SUSPICIOUS_KEYWORDS = (
    "login", "log-in", "signin", "sign-in", "logon", "verify", "verification",
    "secure", "security", "account", "update", "confirm", "banking", "password",
    "passwd", "credential", "wallet", "recover", "unlock", "suspend", "billing",
    "invoice", "payment", "webscr", "ebayisapi", "authenticate", "validate",
    "alert", "session", "seed", "kyc", "claim", "prize", "bonus", "gift",
    "refund", "reactivate", "restore", "support", "helpdesk",
)

_EXEC_EXT = (".exe", ".zip", ".scr", ".apk", ".jar", ".msi", ".bat", ".rar", ".7z", ".iso")
_SPECIAL = set("=&%_~!*'();:+$,")
_TOKEN_SPLIT = re.compile(r"[.\-_]")
_PCT = re.compile(r"%[0-9a-fA-F]{2}")

# Ordered feature schema — the single source of truth for the model input.
FEATURE_NAMES = [
    "url_length", "host_length", "path_length", "query_length",
    "num_dots_host", "num_hyphens_host", "num_digits_host", "digit_ratio_host",
    "num_subdomains", "path_depth", "num_query_params", "num_at",
    "has_ip", "has_port", "url_entropy", "host_entropy",
    "num_special", "num_pct_encoded", "suspicious_keyword_count",
    "risky_tld", "tld_length", "is_shortener", "has_punycode",
    "double_slash_in_path", "free_hosting", "ext_php", "ext_exec",
    "brand_impersonation_score", "exact_brand_match", "embedded_brand",
    "brand_in_subdomain", "brand_in_path", "brand_wrong_tld", "longest_host_token",
    "tld_id",
]

# Columns the gradient-boosting model treats as categorical.
CATEGORICAL_FEATURES = ["tld_id"]


def shannon_entropy(s: str) -> float:
    """Shannon entropy of a string (bits per symbol)."""
    if not s:
        return 0.0
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in (s.count(ch) for ch in dict.fromkeys(s)))


def _brand_hit(brand: str, tokens: list[str], text: str) -> bool:
    """Whether `brand` appears in tokens/text without matching inside unrelated words
    (e.g. 'chase' in 'purchase', 'apple' in 'pineapple')."""
    if len(brand) >= 6:
        return brand in text
    for t in tokens:
        # Exact token, or brand used as a prefix ("applesupport", "chaseverify").
        # Suffix matches are excluded on purpose: "purchase", "pineapple".
        if t == brand or (len(brand) >= 4 and t.startswith(brand) and len(t) - len(brand) >= 3):
            return True
    return False


_WWW = re.compile(r"^www\d*\.", re.I)


def _split_url(url: str):
    raw = url.strip()
    rest = raw.split("://", 1)[1] if "://" in raw else raw
    # "www." carries no real risk signal; dropping it removes a strong dataset
    # artefact (benign feeds rarely include it, real browsing nearly always does).
    rest = _WWW.sub("", rest)
    parts = urlsplit("http://" + rest)
    host = (parts.hostname or "").lower().rstrip(".")
    canon = rest.split("#", 1)[0]
    return canon, host, parts


def extract_url_features(url: str) -> dict:
    """Extract the ordered feature dict (keys == FEATURE_NAMES) for one URL."""
    canon, host, parts = _split_url(url)
    try:
        port = parts.port
    except ValueError:
        port = None
    path = parts.path or ""
    query = parts.query or ""
    lower = canon.lower()

    ext = _tld_extract(host)
    reg_label = (ext.domain or "").lower()
    suffix = (ext.suffix or "").lower()
    registered = f"{reg_label}.{suffix}" if suffix else reg_label
    sub = (ext.subdomain or "").lower()
    sub_no_www = sub[4:] if sub.startswith("www.") else ("" if sub == "www" else sub)

    try:
        ipaddress.ip_address(host.strip("[]"))
        is_ip = 1
    except ValueError:
        is_ip = 0

    host_tokens = [t for t in _TOKEN_SPLIT.split(host) if t]
    sub_tokens = [t for t in _TOKEN_SPLIT.split(sub_no_www) if t]
    path_tokens = [t for t in re.split(r"[/.\-_?=&]", path.lower()) if t]
    host_digits = sum(c.isdigit() for c in host)

    # --- Brand signals -------------------------------------------------------
    exact_brand = 0
    wrong_tld = 0
    embedded = 0
    in_sub = 0
    in_path = 0
    best_dist = math.inf
    name_tokens = sub_tokens + [t for t in _TOKEN_SPLIT.split(reg_label) if t]
    if registered in BRAND_OWNED_DOMAINS:
        exact_brand = 1
    for brand in TOP_BRANDS:
        if exact_brand and registered in BRAND_OWNED_DOMAINS:
            break
        if reg_label == brand:
            if suffix in OFFICIAL_BRAND_SUFFIXES:
                exact_brand = 1
            else:
                wrong_tld = 1
                embedded = 1
            continue
        if _brand_hit(brand, name_tokens, sub_no_www + "." + reg_label):
            embedded = 1
            if _brand_hit(brand, sub_tokens, sub_no_www):
                in_sub = 1
        if _brand_hit(brand, path_tokens, path.lower()):
            in_path = 1
        if len(brand) >= 5:
            thr = 1 if len(brand) < 8 else 2
            for tok in [reg_label] + [t for t in _TOKEN_SPLIT.split(reg_label) if len(t) >= 4]:
                if abs(len(tok) - len(brand)) > thr:
                    continue
                d = jellyfish.levenshtein_distance(brand, tok)
                if 1 <= d <= thr and d < best_dist:
                    best_dist = d

    feats = {
        "url_length": len(canon),
        "host_length": len(host),
        "path_length": len(path),
        "query_length": len(query),
        "num_dots_host": host.count("."),
        "num_hyphens_host": host.count("-"),
        "num_digits_host": host_digits,
        "digit_ratio_host": round(host_digits / len(host), 4) if host else 0.0,
        "num_subdomains": len(sub_tokens) if not is_ip else 0,
        "path_depth": len([s for s in path.split("/") if s]),
        "num_query_params": len([q for q in query.split("&") if q]) if query else 0,
        "num_at": canon.count("@"),
        "has_ip": is_ip,
        "has_port": 1 if port else 0,
        "url_entropy": round(shannon_entropy(lower), 4),
        "host_entropy": round(shannon_entropy(host), 4),
        "num_special": sum(1 for c in canon if c in _SPECIAL),
        "num_pct_encoded": len(_PCT.findall(canon)),
        "suspicious_keyword_count": sum(1 for k in SUSPICIOUS_KEYWORDS if k in lower),
        "risky_tld": 1 if suffix.split(".")[-1] in RISKY_TLDS else 0,
        "tld_length": len(suffix),
        "is_shortener": 1 if (host in SHORTENERS or registered in SHORTENERS) else 0,
        "has_punycode": 1 if "xn--" in host else 0,
        "double_slash_in_path": 1 if "//" in path else 0,
        "free_hosting": 1 if (registered in FREE_HOSTING or any(host == f or host.endswith("." + f) for f in FREE_HOSTING)) else 0,
        "ext_php": 1 if ".php" in path.lower() else 0,
        "ext_exec": 1 if path.lower().endswith(_EXEC_EXT) else 0,
        # 100 = no resemblance / exact brand; small values = near-miss typosquat.
        "brand_impersonation_score": 100 if (exact_brand or best_dist == math.inf) else int(best_dist),
        "exact_brand_match": exact_brand,
        "embedded_brand": embedded,
        "brand_in_subdomain": in_sub,
        "brand_in_path": in_path,
        "brand_wrong_tld": wrong_tld,
        "longest_host_token": max((len(t) for t in host_tokens), default=0),
        "tld_id": _TLD_INDEX.get(suffix.split(".")[-1], 0) if suffix else 0,
    }
    return feats


def feature_vector(url: str) -> list[float]:
    """Feature values in FEATURE_NAMES order (what the model consumes)."""
    f = extract_url_features(url)
    return [f[name] for name in FEATURE_NAMES]
