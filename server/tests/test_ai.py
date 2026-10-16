import json
from app.features.phishing.service import score_phishing_service
from app.features.fraud.service import score_transaction_service
from app.core.database import SessionLocal

def run_tests():
    print("Testing Phishing Engine...\n")
    
    db = SessionLocal()
    try:
        # 1. Safe URL
        safe_res = score_phishing_service(db, "https://google.com")
        print("Safe URL Result:")
        print(json.dumps(safe_res, indent=2))
        print("\n" + "-"*30)

        # 2. Phishing URL (no text)
        phish_res = score_phishing_service(db, "http://login-update-account.pw")
        print("Phishing URL Result:")
        print(json.dumps(phish_res, indent=2))
        print("\n" + "-"*30)

        # 3. Phishing URL + Text
        phish_text = "Dear user, your account will be suspended. Please login immediately to verify your identity at the link below."
        phish_res_text = score_phishing_service(db, "http://login-update-account.pw", phish_text)
        print("Phishing URL + Text Result:")
        print(json.dumps(phish_res_text, indent=2))
        print("\n" + "-"*30)
        
        print("\nTesting Fraud Engine...\n")
        
        # 4. Legitimate Transaction
        norm_txn = score_transaction_service(db, amount=45.50, velocity=2, hour=14, geo_distance=10.5)
        print("Normal Transaction Result:")
        print(json.dumps(norm_txn, indent=2))
        print("\n" + "-"*30)

        # 5. Fraudulent Transaction
        fraud_txn = score_transaction_service(db, amount=15000.00, velocity=15, hour=3, geo_distance=2500.0)
        print("Fraudulent Transaction Result:")
        print(json.dumps(fraud_txn, indent=2))
        
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
