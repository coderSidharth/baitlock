import sys
import unittest
from pathlib import Path

# Add server directory to sys.path
server_dir = Path(__file__).resolve().parent.parent
if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
# Register every model on Base so create_all() can resolve foreign keys
# (e.g. phishing_events.user_id -> users.id) when this file runs on its own.
import app.features.auth.models  # noqa: F401,E402
import app.features.chat.models  # noqa: F401,E402
import app.features.companies.models  # noqa: F401,E402
import app.features.fraud.models  # noqa: F401,E402
from app.common.rule_engine import rule_check_phishing, rule_check_transaction
from app.features.phishing.features import extract_url_features, shannon_entropy
from app.features.phishing.service import _is_safe_url, score_phishing_service
from app.features.phishing.models import UserBlocklist, UserWhitelist, PhishingEvent
from app.features.fraud.service import score_transaction_service


class TestRuleEngine(unittest.TestCase):
    def test_https_and_clean_url(self):
        res = rule_check_phishing("https://example.com")
        self.assertEqual(res["rule_score"], 100)
        self.assertEqual(len(res["rule_reasons"]), 0)

    def test_http_penalty(self):
        res = rule_check_phishing("http://example.com")
        self.assertLess(res["rule_score"], 100)
        self.assertTrue(any("HTTPS" in r for r in res["rule_reasons"]))

    def test_suspicious_tlds(self):
        for tld in [".pw", ".xyz", ".top", ".tk", ".club"]:
            res = rule_check_phishing(f"https://account-update{tld}")
            self.assertLessEqual(res["rule_score"], 60)
            self.assertTrue(any("suspicious TLD" in r for r in res["rule_reasons"]))

    def test_ip_address_url(self):
        res = rule_check_phishing("http://192.168.1.50/login")
        self.assertLessEqual(res["rule_score"], 30)
        self.assertTrue(any("IP address" in r for r in res["rule_reasons"]))

    def test_excessive_subdomains(self):
        res = rule_check_phishing("https://a.b.c.d.example.com")
        self.assertTrue(any("subdomains" in r for r in res["rule_reasons"]))

    def test_punycode_detection(self):
        res = rule_check_phishing("https://xn--pple-43d.com")
        self.assertTrue(any("Punycode" in r for r in res["rule_reasons"]))

    def test_transaction_rules(self):
        # Exceeds limit
        res_limit = rule_check_transaction(amount=12000.0, velocity=1, hour=12, geo_distance=5.0)
        self.assertLess(res_limit["rule_score"], 100)
        self.assertTrue(any("$10,000" in r for r in res_limit["rule_reasons"]))

        # Impossible travel
        res_geo = rule_check_transaction(amount=50.0, velocity=1, hour=12, geo_distance=6000.0)
        self.assertLess(res_geo["rule_score"], 100)
        self.assertTrue(any("travel" in r for r in res_geo["rule_reasons"]))


class TestFeatureExtraction(unittest.TestCase):
    def test_shannon_entropy(self):
        self.assertEqual(shannon_entropy(""), 0.0)
        # Uniform characters have 0 entropy
        self.assertEqual(shannon_entropy("aaaaaa"), 0.0)
        # Random string has high entropy
        self.assertGreater(shannon_entropy("x82kz-0q1m9-auth"), 3.0)

    def test_brand_legitimate_exact(self):
        feats = extract_url_features("https://www.paypal.com/signin")
        self.assertEqual(feats["exact_brand_match"], 1)
        self.assertEqual(feats["embedded_brand"], 0)

    def test_brand_deceptive_impersonation(self):
        feats = extract_url_features("http://paypal.com.evil.xyz/login")
        self.assertEqual(feats["exact_brand_match"], 0)
        self.assertEqual(feats["embedded_brand"], 1)

    def test_brand_typosquatting(self):
        feats = extract_url_features("http://paypa1-security.com/update")
        self.assertLessEqual(feats["brand_impersonation_score"], 3)


class TestSSRFProtection(unittest.TestCase):
    def test_reject_private_ips(self):
        self.assertFalse(_is_safe_url("http://127.0.0.1:8000/api"))
        self.assertFalse(_is_safe_url("http://localhost/admin"))
        self.assertFalse(_is_safe_url("http://169.254.169.254/latest/meta-data"))
        self.assertFalse(_is_safe_url("http://10.0.0.1/status"))
        self.assertFalse(_is_safe_url("http://192.168.0.1/router"))

    def test_reject_non_http(self):
        self.assertFalse(_is_safe_url("file:///etc/passwd"))
        self.assertFalse(_is_safe_url("ftp://server.local"))
        self.assertFalse(_is_safe_url("javascript:alert(1)"))


class TestServiceDatabasePaths(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create an isolated in-memory SQLite DB for testing
        cls.test_engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=cls.test_engine)
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.test_engine)

    @classmethod
    def tearDownClass(cls):
        cls.test_engine.dispose()

    def setUp(self):
        self.db = self.TestingSessionLocal()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def test_blocklist_immediate_critical(self):
        # Add entry to blocklist
        bl = UserBlocklist(user_id=42, domain="malicious-tracker.xyz")
        self.db.add(bl)
        self.db.commit()

        res = score_phishing_service(self.db, "https://malicious-tracker.xyz/track", user_id=42, fast_mode=True)
        self.assertEqual(res["final_score"], 0)
        self.assertEqual(res["tier"], "critical")
        self.assertIn("BLOCKED", res["verdict"])

    def test_whitelist_immediate_safe(self):
        wl = UserWhitelist(user_id=42, domain="internal-tools.corp")
        self.db.add(wl)
        self.db.commit()

        res = score_phishing_service(self.db, "https://internal-tools.corp/dashboard", user_id=42, fast_mode=True)
        self.assertEqual(res["final_score"], 100)
        self.assertEqual(res["tier"], "safe")
        self.assertIn("SAFE", res["verdict"])

    def test_no_substring_matching_vulnerability(self):
        # Whitelisting paypal.com must NOT whitelist notpaypal.com
        wl = UserWhitelist(user_id=77, domain="paypal.com")
        self.db.add(wl)
        self.db.commit()

        res = score_phishing_service(self.db, "http://notpaypal.com/login", user_id=77, fast_mode=True)
        self.assertNotEqual(res["verdict"], "SAFE (Reviewed by You)")

    def test_cache_scoped_by_user(self):
        # Scan for user 10
        score_phishing_service(self.db, "http://test-site.org", user_id=10, fast_mode=True)
        
        # User 20 cache check should NOT find user 10's cached event
        cache_hit_u20 = self.db.query(PhishingEvent).filter(
            PhishingEvent.input_url == "http://test-site.org",
            PhishingEvent.user_id == 20
        ).first()
        self.assertIsNone(cache_hit_u20)

        cache_hit_u10 = self.db.query(PhishingEvent).filter(
            PhishingEvent.input_url == "http://test-site.org",
            PhishingEvent.user_id == 10
        ).first()
        self.assertIsNotNone(cache_hit_u10)


if __name__ == "__main__":
    unittest.main()
