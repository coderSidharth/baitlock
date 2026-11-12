from app.common.rule_engine import rule_check_phishing
from app.features.phishing.phishing_ml import predict_phishing_ml
from app.integrations.llm import analyze_text_with_llm
from app.features.phishing.repository import phishing_repo, cache_key_for_url
from sqlalchemy.orm import Session
from app.features.phishing.models import UserWhitelist, UserBlocklist, PhishingEvent
from app.features.phishing.reputation import domain_reputation
import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse, urljoin, urlunparse
import ipaddress
import requests
import urllib3
import time
import re
import socket

logger = logging.getLogger(__name__)

def normalize_domain(value: str) -> str:
    candidate = value.strip()
    parsed = urlparse(candidate if "://" in candidate else f"//{candidate}")
    return (parsed.hostname or candidate.split("/", 1)[0].split(":", 1)[0]).lower().rstrip(".")


_LABEL = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$")


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
    from app.features.auth.models import User
    db.query(User).filter(User.id == user_id).with_for_update().first()
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
    from app.features.auth.models import User
    db.query(User).filter(User.id == user_id).with_for_update().first()
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

_MAX_RESPONSE_BYTES = 1_000_000  # 1 MB — reject responses larger than this


def _resolve_safe_ip(url: str) -> str | None:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            return None
        if parsed.port not in (None, 80, 443):
            return None
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), socket.AF_UNSPEC, socket.SOCK_STREAM)
        ips = [ipaddress.ip_address(item[4][0]) for item in addresses]
        if not ips or any(not ip.is_global or ip.is_multicast or ip.ipv4_mapped is not None
                          for ip in ips if isinstance(ip, ipaddress.IPv6Address)):
            return None
        if any(not ip.is_global or ip.is_multicast for ip in ips):
            return None
        return str(ips[0])
    except (OSError, ValueError, UnicodeError):
        return None


def _is_safe_url(url: str) -> bool:
    return _resolve_safe_ip(url) is not None


def fetch_page_content(url: str) -> str:
    """Pin each hop's public IP while verifying TLS against the original hostname."""
    deadline = time.monotonic() + 8
    for _ in range(4):
        pinned_ip = _resolve_safe_ip(url)
        if pinned_ip is None or time.monotonic() >= deadline:
            return ""
        parsed = urlparse(url)
        pool = None
        response = None
        try:
            kwargs = {"port": parsed.port or (443 if parsed.scheme == "https" else 80)}
            if parsed.scheme == "https":
                pool = urllib3.HTTPSConnectionPool(
                    pinned_ip, server_hostname=parsed.hostname, assert_hostname=parsed.hostname,
                    cert_reqs="CERT_REQUIRED", ca_certs=requests.certs.where(), **kwargs,
                )
            else:
                pool = urllib3.HTTPConnectionPool(pinned_ip, **kwargs)
            host = f"[{parsed.hostname}]" if ":" in parsed.hostname else parsed.hostname
            if parsed.port:
                host += f":{parsed.port}"
            path = urlunparse(("", "", parsed.path or "/", parsed.params, parsed.query, ""))
            response = pool.urlopen(
                "GET", path, headers={"Host": host, "User-Agent": "Baitlock/1.0", "Accept-Encoding": "identity"},
                timeout=urllib3.Timeout(connect=2, read=2, total=max(0.1, deadline - time.monotonic())),
                redirect=False, retries=False, preload_content=False,
            )
            if response.status in (301, 302, 303, 307, 308):
                location = response.headers.get("Location")
                if not location:
                    return ""
                url = urljoin(url, location)  # every redirect is resolved, checked and pinned again
                continue
            if response.status >= 400 or response.headers.get("Content-Encoding", "identity") != "identity":
                return ""
            content_type = response.headers.get("Content-Type", "").lower()
            if "text/" not in content_type:
                return ""
            body = bytearray()
            while len(body) <= _MAX_RESPONSE_BYTES and time.monotonic() < deadline:
                # read1 returns after one socket read. A peer trickling bytes must
                # not keep a read(n) call alive past our overall deadline.
                chunk = response.read1(min(8192, _MAX_RESPONSE_BYTES + 1 - len(body)), decode_content=False)
                if not chunk:
                    return strip_tags(body.decode("utf-8", errors="replace"))[:3000]
                body.extend(chunk)
            return ""
        except (urllib3.exceptions.HTTPError, OSError, ValueError):
            logger.warning("Page content fetch failed")
            return ""
        finally:
            if response is not None:
                response.close()
            if pool is not None:
                pool.close()
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
                "breakdown": {"rule_score": 0, "ml_score": 0, "llm_score": None}
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
                "breakdown": {"rule_score": 0, "ml_score": 0, "llm_score": None}
            }
            phishing_repo.create(db, url, text_content, result, user_id=user_id)
            return result
            
    # Check Cache only for fast background scans
    if fast_mode:
        cached_event = (
            db.query(PhishingEvent)
            .filter(
                PhishingEvent.cache_key == cache_key_for_url(url),
                PhishingEvent.user_id == user_id,
                PhishingEvent.created_at >= datetime.now(timezone.utc) - timedelta(hours=12),
            )
            .order_by(PhishingEvent.created_at.desc(), PhishingEvent.id.desc())
            .first()
        )
        if cached_event and _is_override_verdict(cached_event.verdict):
            cached_event = None

        if cached_event:
            reasons = []
            if cached_event.reasons_jsonb:
                try:
                    reasons = json.loads(cached_event.reasons_jsonb)
                except (ValueError, TypeError):
                    logger.warning("Invalid stored phishing reasons")
            
            from app.common.schemas import tier_for_verdict
            tier = tier_for_verdict(cached_event.verdict, cached_event.final_score)

            result = {
                "final_score": cached_event.final_score,
                "verdict": cached_event.verdict.replace(" (Cached)", "") + " (Cached)",
                "tier": tier,
                "reasons": reasons,
                "breakdown": {"rule_score": 0, "ml_score": 0, "llm_score": None}
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
    
    # Community votes remain advisory: unverified accounts cannot change a verdict.
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
            "llm_score": llm_res.get("llm_score")
        }
    }
    
    # Only deterministic fast scans may populate the navigation cache. Otherwise
    # client-supplied page text could poison shared anonymous URL verdicts.
    phishing_repo.create(db, url, text_content, result, user_id=user_id, cacheable=fast_mode)
    return result
