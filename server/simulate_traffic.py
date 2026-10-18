"""
Baitlock Threat Traffic Generator & Live Simulation Script.
Generates realistic, varied Phishing and Fraud events to populate
the Threat Matrix, Live Feed, and Dashboard Analytics.

Usage:
    python simulate_traffic.py           # Seeds a rich batch of 30+ varied threat events
    python simulate_traffic.py --stream  # Continuously emits live events every 3-5 seconds
    python simulate_traffic.py --clear   # Clears all events before seeding
"""

import sys
import time
import json
import random
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Ensure server module is importable
server_dir = Path(__file__).resolve().parent
if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))

from app.core.database import SessionLocal, engine, Base
from app.features.phishing.models import PhishingEvent
from app.features.fraud.models import FraudEvent
from app.features.auth.models import User

# Sample datasets
PHISHING_SAMPLES = [
    {
        "url": "https://chase-security-verify-id.top/login.php",
        "score": 12,
        "verdict": "CRITICAL_PHISHING",
        "tier": "critical",
        "reasons": [
            "Financial brand impersonation detected (Chase)",
            "High-risk top-level domain (.top)",
            "Aggressive urgency and credential harvesting forms"
        ]
    },
    {
        "url": "http://paypal-account-suspended-action.pw/restore",
        "score": 15,
        "verdict": "CRITICAL_PHISHING",
        "tier": "critical",
        "reasons": [
            "Payment provider impersonation (PayPal)",
            "Unencrypted plain HTTP communication",
            "Domain uses suspicious TLD (.pw)",
            "Deceptive threat language in page body"
        ]
    },
    {
        "url": "https://microsoft-office365-security-update.xyz/auth",
        "score": 18,
        "verdict": "CRITICAL_PHISHING",
        "tier": "critical",
        "reasons": [
            "Corporate cloud provider typosquatting (Microsoft)",
            "High-abuse TLD (.xyz)",
            "Detected credential harvesting script payload"
        ]
    },
    {
        "url": "http://appleid-support-alert.pw/recovery",
        "score": 26,
        "verdict": "HIGH_RISK",
        "tier": "high",
        "reasons": [
            "Apple ID impersonation indicators",
            "Insecure HTTP protocol",
            "Domain registered < 48 hours ago"
        ]
    },
    {
        "url": "https://dhl-express-parcel-tracking-update.info/track",
        "score": 32,
        "verdict": "HIGH_RISK",
        "tier": "high",
        "reasons": [
            "Logistics delivery scam template",
            "Excessive subdomain depth",
            "Unusual domain registration pattern"
        ]
    },
    {
        "url": "http://metamask-crypto-wallet-validate.club/connect",
        "score": 22,
        "verdict": "CRITICAL_PHISHING",
        "tier": "critical",
        "reasons": [
            "Web3 wallet seed phrase harvesting pattern",
            "Suspicious TLD (.club)",
            "Uncertified SSL authority"
        ]
    },
    {
        "url": "https://free-gift-cards-claim-today.site/promo",
        "score": 48,
        "verdict": "MODERATE_RISK",
        "tier": "moderate",
        "reasons": [
            "Deceptive promotional survey format",
            "Aggressive pop-up redirect behavior",
            "Low trust domain registrar"
        ]
    },
    {
        "url": "http://streaming-hd-movies-fast.cc/watch",
        "score": 52,
        "verdict": "MODERATE_RISK",
        "tier": "moderate",
        "reasons": [
            "Unverified media portal with adware vectors",
            "Insecure download redirection"
        ]
    },
    {
        "url": "https://github.com/login",
        "score": 100,
        "verdict": "SAFE",
        "tier": "safe",
        "reasons": ["Global enterprise whitelist verified", "Valid Extended Validation SSL certificate"]
    },
    {
        "url": "https://google.com/search?q=cybersecurity+best+practices",
        "score": 100,
        "verdict": "SAFE",
        "tier": "safe",
        "reasons": ["Global enterprise whitelist verified", "High domain reputation score"]
    },
    {
        "url": "https://stripe.com/docs/api",
        "score": 98,
        "verdict": "SAFE",
        "tier": "safe",
        "reasons": ["Verified payment infrastructure", "HSTS preloaded domain"]
    },
    {
        "url": "https://amazon.com/gp/buy/spc/handlers/display.html",
        "score": 99,
        "verdict": "SAFE",
        "tier": "safe",
        "reasons": ["Verified e-commerce platform", "High trust rating"]
    }
]

FRAUD_SAMPLES = [
    {
        "amount": 14999.00,
        "velocity": 18,
        "hour": 3,
        "geo_distance": 4800.0,
        "score": 12,
        "verdict": "FRAUD",
        "tier": "critical",
        "reasons": [
            "Transaction amount exceeds hard limit ($10,000)",
            "Extreme transaction velocity (18 txns/min)",
            "Transaction initiated at high-risk hour (03:00 AM)",
            "Severe geolocation anomaly (>4,500 km from billing origin)"
        ]
    },
    {
        "amount": 8450.00,
        "velocity": 14,
        "hour": 2,
        "geo_distance": 3200.0,
        "score": 19,
        "verdict": "FRAUD",
        "tier": "critical",
        "reasons": [
            "Rapid multi-card burst velocity",
            "High ticket transaction on newly linked account",
            "Foreign IP mismatch"
        ]
    },
    {
        "amount": 2850.00,
        "velocity": 8,
        "hour": 23,
        "geo_distance": 920.0,
        "score": 42,
        "verdict": "REVIEW_NEEDED",
        "tier": "high",
        "reasons": [
            "Unusual velocity burst for user profile",
            "Late night checkout timing",
            "Moderate geo-distance variance"
        ]
    },
    {
        "amount": 1200.00,
        "velocity": 5,
        "hour": 1,
        "geo_distance": 550.0,
        "score": 58,
        "verdict": "MODERATE_RISK",
        "tier": "moderate",
        "reasons": [
            "Device fingerprint change detected",
            "Transaction amount higher than monthly average"
        ]
    },
    {
        "amount": 42.50,
        "velocity": 1,
        "hour": 14,
        "geo_distance": 8.0,
        "score": 100,
        "verdict": "LEGITIMATE",
        "tier": "safe",
        "reasons": ["Standard consumer transaction", "Consistent billing device and location"]
    },
    {
        "amount": 128.00,
        "velocity": 2,
        "hour": 17,
        "geo_distance": 15.0,
        "score": 97,
        "verdict": "LEGITIMATE",
        "tier": "safe",
        "reasons": ["Routine retail purchase", "Low velocity pattern"]
    },
    {
        "amount": 18.99,
        "velocity": 1,
        "hour": 19,
        "geo_distance": 3.0,
        "score": 100,
        "verdict": "LEGITIMATE",
        "tier": "safe",
        "reasons": ["Recurring digital subscription", "Zero risk factors detected"]
    }
]

def seed_batch(count: int = 35):
    """Seeds a batch of events with staggered timestamps over the past 4 hours."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    users = db.query(User).all()
    user_ids = [u.id for u in users] + [None, None]  # Include global unassigned events

    now = datetime.now(timezone.utc)
    print(f"[*] Generating {count} synthetic security events...")

    for i in range(count):
        # Stagger created_at backward in time (up to 4 hours ago)
        offset_seconds = random.randint(10, 14400)
        event_time = now - timedelta(seconds=offset_seconds)
        assigned_user = random.choice(user_ids) if user_ids else None

        # 60% chance phishing, 40% chance fraud
        if random.random() < 0.6:
            sample = random.choice(PHISHING_SAMPLES)
            # Add slight score noise
            score = max(0, min(100, sample["score"] + random.randint(-4, 4)))
            event = PhishingEvent(
                user_id=assigned_user,
                input_url=sample["url"],
                input_text=None,
                final_score=score,
                verdict=sample["verdict"],
                reasons_jsonb=json.dumps(sample["reasons"]),
                created_at=event_time
            )
            db.add(event)
        else:
            sample = random.choice(FRAUD_SAMPLES)
            score = max(0, min(100, sample["score"] + random.randint(-3, 3)))
            event = FraudEvent(
                user_id=assigned_user,
                amount=round(sample["amount"] + random.uniform(-10.0, 10.0), 2),
                velocity=sample["velocity"],
                hour=sample["hour"],
                geo_distance=sample["geo_distance"],
                final_score=score,
                verdict=sample["verdict"],
                reasons_jsonb=json.dumps(sample["reasons"]),
                created_at=event_time
            )
            db.add(event)

    db.commit()
    total_p = db.query(PhishingEvent).count()
    total_f = db.query(FraudEvent).count()
    print(f"[+] Seed complete! Total Phishing Events: {total_p}, Total Fraud Events: {total_f}")
    db.close()

def stream_live_events(interval_sec: float = 4.0):
    """Continuously generates realistic live security events in real-time."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    users = db.query(User).all()
    user_ids = [u.id for u in users] + [None]
    db.close()

    print(f"[*] Starting live threat stream (1 event every ~{interval_sec}s). Press Ctrl+C to stop.")
    try:
        while True:
            db = SessionLocal()
            assigned_user = random.choice(user_ids) if user_ids else None
            now = datetime.now(timezone.utc)

            if random.random() < 0.55:
                sample = random.choice(PHISHING_SAMPLES)
                score = max(0, min(100, sample["score"] + random.randint(-3, 3)))
                event = PhishingEvent(
                    user_id=assigned_user,
                    input_url=sample["url"],
                    input_text=None,
                    final_score=score,
                    verdict=sample["verdict"],
                    reasons_jsonb=json.dumps(sample["reasons"]),
                    created_at=now
                )
                db.add(event)
                db.commit()
                print(f"[{now.strftime('%H:%M:%S')}] PHISHING -> {sample['url']} | Score: {score} | Tier: {sample['tier']}")
            else:
                sample = random.choice(FRAUD_SAMPLES)
                score = max(0, min(100, sample["score"] + random.randint(-3, 3)))
                amount = round(sample["amount"] + random.uniform(-5.0, 5.0), 2)
                event = FraudEvent(
                    user_id=assigned_user,
                    amount=amount,
                    velocity=sample["velocity"],
                    hour=now.hour,
                    geo_distance=sample["geo_distance"],
                    final_score=score,
                    verdict=sample["verdict"],
                    reasons_jsonb=json.dumps(sample["reasons"]),
                    created_at=now
                )
                db.add(event)
                db.commit()
                print(f"[{now.strftime('%H:%M:%S')}] FRAUD    -> Amount: ${amount} | Score: {score} | Tier: {sample['tier']}")

            db.close()
            time.sleep(interval_sec + random.uniform(-0.8, 1.2))
    except KeyboardInterrupt:
        print("\n[*] Stopped threat stream.")

if __name__ == "__main__":
    if "--clear" in sys.argv:
        db = SessionLocal()
        db.query(PhishingEvent).delete()
        db.query(FraudEvent).delete()
        db.commit()
        print("[*] Database event tables cleared.")
        db.close()

    if "--stream" in sys.argv:
        stream_live_events(3.0)
    else:
        seed_batch(35)
