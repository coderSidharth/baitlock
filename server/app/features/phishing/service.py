from app.common.rule_engine import rule_check_phishing
from app.features.phishing.phishing_ml import predict_phishing_ml
from app.integrations.llm import analyze_text_with_llm
from app.features.phishing.repository import phishing_repo
from sqlalchemy.orm import Session
from app.features.phishing.models import UserWhitelist, UserBlocklist, PhishingEvent
from app.features.phishing.reputation import domain_reputation
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
import ipaddress
import requests
import re

def normalize_domain(value: str) -> str:
    candidate = value.strip()
    parsed = urlparse(candidate if "://" in candidate else f"//{candidate}")
    return (parsed.hostname or candidate.split("/", 1)[0].split(":", 1)[0]).lower().rstrip(".")


_LABEL = re.compile(r"^(?!-)[a-z0-9_-]{1,63}(?<!-)$")


def is_valid_domain(domain: str) -> bool:
    """True for a real hostname (at least one dot, valid labels and TLD) or an IP address."""
    if not domain or len(domain) > 253:
        return False
    try:
        ipaddress.ip_address(domain)
        return True
    except ValueError:
        pass
    labels = domain.split(".")
    if len(labels) < 2 or not all(_LABEL.match(label) for label in labels):
        return False
    tld = labels[-1]
    return tld.startswith("xn--") or (tld.isalpha() and len(tld) >= 2)


def require_domain(value: str) -> str:
    """Normalize `value` to a domain or raise ValueError (e.g. for "Txn: $15000.0")."""
    domain = normalize_domain(value)
    if not is_valid_domain(domain):
        raise ValueError(f"'{value}' is not a valid domain name")
    return domain


def set_whitelisted(db: Session, user_id: int, domain: str) -> str:
    """Add a domain to the user's whitelist, removing it from the blocklist.

    Whitelist and blocklist are mutually exclusive: a domain can only ever be on
    one of them for a given user, so trusting a site also un-blocks it.
    Raises ValueError if `domain` is not a valid domain name.
    """
    domain = require_domain(domain)
    # Remove any conflicting blocklist entry first (mutual exclusivity)
    db.query(UserBlocklist).filter(
        UserBlocklist.user_id == user_id,
        UserBlocklist.domain == domain
    ).delete(synchronize_session=False)
    existing = db.query(UserWhitelist).filter(
        UserWhitelist.user_id == user_id,
        UserWhitelist.domain == domain
    ).first()
    if not existing:
        db.add(UserWhitelist(user_id=user_id, domain=domain))
    db.commit()
    return domain


def set_blocklisted(db: Session, user_id: int, domain: str) -> str:
    """Add a domain to the user's blocklist, removing it from the whitelist.

    Mutual exclusivity mirror of set_whitelisted: blocking a site also un-trusts it.
    Raises ValueError if `domain` is not a valid domain name.
    """
    domain = require_domain(domain)
    # Remove any conflicting whitelist entry first (mutual exclusivity)
    db.query(UserWhitelist).filter(
        UserWhitelist.user_id == user_id,
        UserWhitelist.domain == domain
    ).delete(synchronize_session=False)
    existing = db.query(UserBlocklist).filter(
        UserBlocklist.user_id == user_id,
        UserBlocklist.domain == domain
    ).first()
    if not existing:
        db.add(UserBlocklist(user_id=user_id, domain=domain))
    db.commit()
    return domain

# Verdicts produced by the user's own block/whitelist rather than by detection.
_OVERRIDE_VERDICT_MARKERS = ("User Blocklist", "Reviewed by You")


def _is_override_verdict(verdict: str | None) -> bool:
    return any(m in (verdict or "") for m in _OVERRIDE_VERDICT_MARKERS)


def strip_tags(html: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', html)
    return ' '.join(text.split())

import socket

def _is_safe_url(url: str) -> bool:
    """Reject URLs that would cause SSRF (internal IPs, non-http schemes, metadata endpoints)."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        # Resolve the hostname and check if it's a private/reserved IP
        resolved = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for _, _, _, _, sockaddr in resolved:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_reserved or ip.is_loopback or ip.is_link_local:
                return False
        return True
    except Exception:
        return False

def fetch_page_content(url: str) -> str:
    if not _is_safe_url(url):
        return ""
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=5, allow_redirects=False)
        res.raise_for_status()
        return strip_tags(res.text)[:3000]
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return ""


def score_phishing_service(db: Session, url: str, text_content: str = None, user_id: int = None, fast_mode: bool = False) -> dict:
    domain = normalize_domain(url)
    if user_id:
        # Check BLOCKLIST first (takes priority over everything)
        blocklist_entries = db.query(UserBlocklist).filter(
            UserBlocklist.user_id == user_id
        ).all()
        
        blocklist_match = any(
            domain == b.domain or domain.endswith("." + b.domain)
            for b in blocklist_entries
        )
        
        if blocklist_match:
            result = {
                "final_score": 0,
                "verdict": "BLOCKED (User Blocklist)",
                "tier": "critical",
                "reasons": ["This domain is on your personal blocklist."],
                "breakdown": {"rule_score": 0, "ml_score": 0, "llm_score": 0}
            }
            phishing_repo.create(db, url, text_content, result, user_id=user_id)
            return result
        
        # Then check whitelist
        whitelist_entries = db.query(UserWhitelist).filter(
            UserWhitelist.user_id == user_id
        ).all()
        
        whitelist_match = any(
            domain == w.domain or domain.endswith("." + w.domain)
            for w in whitelist_entries
        )
        
        if whitelist_match:
            result = {
                "final_score": 100,
                "verdict": "SAFE (Reviewed by You)",
                "tier": "safe",
                "reasons": ["You added this site to your personal safe list."],
                "breakdown": {"rule_score": 0, "ml_score": 0, "llm_score": 0}
            }
            phishing_repo.create(db, url, text_content, result, user_id=user_id)
            return result
            
    # Check Cache only for fast background scans
    if fast_mode:
        # Narrow candidates with a substring filter, then confirm the EXACT host in
        # Python: LIKE '%domain%' alone would let "pay.com" reuse a verdict cached for
        # "paypay.com.evil.xyz". Verdicts that came from the user's own block/whitelist
        # are never replayed: once the override is removed, it must stop applying
        # (otherwise an un-blocked site stays blocked for the cache lifetime).
        candidates = (
            db.query(PhishingEvent)
            .filter(
                PhishingEvent.input_url.contains(domain),
                PhishingEvent.user_id == user_id,
                PhishingEvent.created_at >= datetime.now(timezone.utc) - timedelta(hours=12),
            )
            .order_by(PhishingEvent.created_at.desc())
            .limit(25)
            .all()
        )
        cached_event = next(
            (e for e in candidates
             if normalize_domain(e.input_url) == domain and not _is_override_verdict(e.verdict)),
            None,
        )
    
        if cached_event:
            reasons = []
            if cached_event.reasons_jsonb:
                try:
                    reasons = json.loads(cached_event.reasons_jsonb)
                except Exception:
                    pass
            
            # Determine tier from verdict if possible, otherwise safe
            tier = "safe"
            v = cached_event.verdict.lower()
            if "critical" in v or "blocked" in v: tier = "critical"
            elif "high" in v or "review" in v: tier = "high"
            elif "moderate" in v: tier = "moderate"
            
            result = {
                "final_score": cached_event.final_score,
                "verdict": cached_event.verdict.replace(" (Cached)", "") + " (Cached)",
                "tier": tier,
                "reasons": reasons,
                "breakdown": {"rule_score": 0, "ml_score": 0, "llm_score": 0}
            }
            # Don't create a new event row for cache hits — it floods the feed
            return result
        
    rule_res = rule_check_phishing(url)
    ml_res = predict_phishing_ml(url)
    
    # In fast_mode, never scrape external network to ensure zero navigation latency and eliminate SSRF
    if not text_content and not fast_mode:
        fetched = fetch_page_content(url)
        if fetched:
            text_content = fetched

    llm_res = {"llm_score": None, "llm_reasons": []}
    
    # Calculate base score from Rule and ML engines
    base_weighted = (rule_res["rule_score"] * 0.4) + (ml_res["ml_score"] * 0.6)
    base_min = min(rule_res["rule_score"], ml_res["ml_score"])
    
    # If either engine is very confident it's phishing (< 30), use the min to penalize hard.
    # Otherwise use the weighted average so both engines contribute proportionally.
    if base_min < 30:
        base_score = int(base_min)
    else:
        base_score = int(base_weighted)

    # Early Exit Strategy: Avoid slow LLM if the site is decisively malicious or very safe, OR if fast_mode is True
    if not fast_mode and text_content and 40 <= base_score <= 85:
        llm_analysis = analyze_text_with_llm(text_content)
        llm_res["llm_score"] = llm_analysis.get("llm_score")
        if llm_analysis.get("llm_reason"):
             llm_res["llm_reasons"] = [llm_analysis["llm_reason"]]
        # Use a purely weighted score to prevent LLM false positives (e.g., security blogs) from completely overriding the ML
        if llm_res["llm_score"] is None:
            final_score = base_score
        else:
            final_score = int((rule_res["rule_score"] * 0.3) + (ml_res["ml_score"] * 0.4) + (llm_res["llm_score"] * 0.3))
        
        # If the LLM is highly confident it's a threat (score < 30), aggressively pull down the final score
        if llm_res["llm_score"] is not None and llm_res["llm_score"] < 30:
            final_score = min(final_score, llm_res["llm_score"] + 15)
            
    else:
        final_score = base_score
        
    raw_reasons = rule_res["rule_reasons"] + ml_res["ml_reasons"] + llm_res.get("llm_reasons", [])
    all_reasons = [r for r in raw_reasons if "API error" not in r and "Not enough text" not in r]
    
    # Check community flags from CompanyFlag (require ≥3 distinct users for penalties)
    from app.features.companies.models import CompanyFlag
    from sqlalchemy import func as sa_func
    community_flags = db.query(CompanyFlag).filter(CompanyFlag.domain == domain).all()
    if community_flags:
        # Count distinct users per flag type
        malicious_users = len(set(f.user_id for f in community_flags if f.flag_type == "malicious" and f.user_id))
        legit_users = len(set(f.user_id for f in community_flags if f.flag_type == "legitimate" and f.user_id))
        if malicious_users > legit_users and malicious_users >= 3:
            penalty = min(35, malicious_users * 10)
            final_score = max(0, final_score - penalty)
            all_reasons.append(f"Flagged by community as suspicious ({malicious_users} distinct users)")
        elif legit_users > malicious_users and legit_users >= 3 and final_score < 80:
            final_score = min(100, final_score + 15)
            all_reasons.append("Flagged by community as legitimate domain")

    # Domain reputation: lexical signals alone cannot separate a real bank sign-in page
    # from a convincing fake, so established sites (top popularity list, excluding
    # multi-tenant / user-content platforms) are not blocked on URL shape alone.
    # Hard red flags and a confident LLM content verdict still take precedence.
    rep = domain_reputation(domain)
    llm_score = llm_res.get("llm_score")
    hard_red_flag = "@" in (urlparse(url).netloc or "") or "xn--" in domain
    if rep["trusted"] and not hard_red_flag and (llm_score is None or llm_score >= 30):
        if final_score < 80:
            final_score = 80
            # Keep deterministic findings (e.g. no HTTPS) but drop lexical-model hints
            # that do not apply to an established site.
            all_reasons = [r for r in all_reasons if r in rule_res["rule_reasons"]]
            all_reasons.append("Established domain with strong global reputation.")
    elif (rep["user_content"] or rep["multi_tenant"]) and final_score < 75:
        all_reasons.append("Hosted on a platform where anyone can publish content; the reputable "
                           "parent domain does not vouch for this page.")

    if final_score < 25: 
        verdict = "CRITICAL_RISK"
        tier = "critical"
    elif final_score < 50: 
        verdict = "HIGH_RISK"
        tier = "high"
    elif final_score < 75:
        verdict = "MODERATE_RISK"
        tier = "moderate"
    else: 
        verdict = "SAFE"
        tier = "safe"
        
    result = {
        "final_score": final_score,
        "verdict": verdict,
        "tier": tier,
        "reasons": all_reasons,
        "breakdown": {
            "rule_score": rule_res["rule_score"],
            "ml_score": ml_res["ml_score"],
            "llm_score": llm_res.get("llm_score") if llm_res.get("llm_score") is not None else 0
        }
    }
    
    phishing_repo.create(db, url, text_content, result, user_id=user_id)
    return result
