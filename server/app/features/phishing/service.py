from app.common.rule_engine import rule_check_phishing
from app.features.phishing.phishing_ml import predict_phishing_ml
from app.integrations.llm import analyze_text_with_llm
from app.features.phishing.repository import phishing_repo
from sqlalchemy.orm import Session
from app.features.phishing.models import UserWhitelist, UserBlocklist, PhishingEvent
import json
from datetime import datetime, timedelta
from urllib.parse import urlparse
import requests
import re

def strip_tags(html: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', html)
    return ' '.join(text.split())

def fetch_page_content(url: str) -> str:
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=5)
        res.raise_for_status()
        return strip_tags(res.text)[:3000]
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return ""

def score_phishing_service(db: Session, url: str, text_content: str = None, user_id: int = None, fast_mode: bool = False) -> dict:
    if user_id:
        domain = urlparse(url).hostname or urlparse(url).netloc or url
        
        # Check BLOCKLIST first (takes priority over everything)
        blocklist_entry = db.query(UserBlocklist).filter(
            UserBlocklist.user_id == user_id,
            UserBlocklist.domain.like(f"%{domain}%")
        ).first()
        
        if blocklist_entry:
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
        whitelist_entry = db.query(UserWhitelist).filter(
            UserWhitelist.user_id == user_id, 
            UserWhitelist.domain.like(f"%{domain}%")
        ).first()
        
        if whitelist_entry:
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
        cached_event = db.query(PhishingEvent).filter(
            PhishingEvent.input_url == url,
            PhishingEvent.created_at >= datetime.utcnow() - timedelta(hours=12)
        ).order_by(PhishingEvent.created_at.desc()).first()
    
        if cached_event:
            reasons = []
            if cached_event.reasons_jsonb:
                try:
                    reasons = json.loads(cached_event.reasons_jsonb)
                except:
                    pass
            
            # Determine tier from verdict if possible, otherwise safe
            tier = "safe"
            v = cached_event.verdict.lower()
            if "critical" in v: tier = "critical"
            elif "high" in v or "review" in v: tier = "high"
            elif "moderate" in v: tier = "moderate"
            
            result = {
                "final_score": cached_event.final_score,
                "verdict": cached_event.verdict.replace(" (Cached)", "") + " (Cached)",
                "tier": tier,
                "reasons": reasons,
                "breakdown": {"rule_score": 0, "ml_score": 0, "llm_score": 0}
            }
            phishing_repo.create(db, url, text_content, result, user_id=user_id)
            return result
        
    rule_res = rule_check_phishing(url)
    ml_res = predict_phishing_ml(url)
    
    if not text_content:
        fetched = fetch_page_content(url)
        if fetched:
            text_content = fetched

    llm_res = {"llm_score": 0, "llm_reasons": []}
    
    # Calculate base score from Rule and ML engines first
    base_weighted = (rule_res["rule_score"] * 0.4) + (ml_res["ml_score"] * 0.6)
    base_min = min(rule_res["rule_score"], ml_res["ml_score"])
    
    # Use min to heavily penalize if either engine is confident it's phishing
    base_score = int(min(base_weighted, base_min))

    # Early Exit Strategy: Avoid slow LLM if the site is decisively malicious or very safe, OR if fast_mode is True
    if not fast_mode and text_content and 40 <= base_score <= 85:
        llm_analysis = analyze_text_with_llm(text_content)
        llm_res["llm_score"] = llm_analysis.get("llm_score", 0)
        if llm_analysis.get("llm_reason"):
             llm_res["llm_reasons"] = [llm_analysis["llm_reason"]]
        # Use a purely weighted score to prevent LLM false positives (e.g., security blogs) from completely overriding the ML
        final_score = int((rule_res["rule_score"] * 0.3) + (ml_res["ml_score"] * 0.4) + (llm_res["llm_score"] * 0.3))
        
        # If the LLM is highly confident it's a threat (score < 30), aggressively pull down the final score
        if llm_res["llm_score"] < 30:
            final_score = min(final_score, llm_res["llm_score"] + 15)
            
    else:
        final_score = base_score
        
    raw_reasons = rule_res["rule_reasons"] + ml_res["ml_reasons"] + llm_res.get("llm_reasons", [])
    all_reasons = [r for r in raw_reasons if "Ollama local API error" not in r]
    
    TRUSTED_DOMAINS = {"google.com", "github.com", "microsoft.com", "apple.com", "amazon.com", "netflix.com", "facebook.com", "youtube.com"}
    domain_base = (urlparse(url).hostname or "").lower()
    
    is_trusted = False
    for td in TRUSTED_DOMAINS:
        if domain_base == td or domain_base.endswith(f".{td}"):
            is_trusted = True
            break
            
    if is_trusted and final_score < 50:
        # Only cap trusted domains if the LLM didn't explicitly flag the content as highly malicious
        if llm_res.get("llm_score", 100) >= 30:
            final_score = 50
            all_reasons.append("Final score was capped to Moderate Risk because the root domain is highly trusted.")
        

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
            "llm_score": llm_res.get("llm_score", 0)
        }
    }
    
    phishing_repo.create(db, url, text_content, result, user_id=user_id)
    return result
