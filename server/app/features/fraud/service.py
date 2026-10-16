from app.common.rule_engine import rule_check_transaction
from app.features.fraud.fraud_ml import predict_transaction_fraud
from app.features.fraud.repository import fraud_repo
from sqlalchemy.orm import Session

def score_transaction_service(db: Session, amount: float, velocity: int, hour: int, geo_distance: float, user_id: int = None) -> dict:
    rule_res = rule_check_transaction(amount, velocity, hour, geo_distance)
    ml_res = predict_transaction_fraud(amount, velocity, hour, geo_distance)
    
    final_score = min(rule_res["rule_score"], ml_res["fraud_score"])
    all_reasons = list(dict.fromkeys(rule_res["rule_reasons"] + ml_res["fraud_reasons"]))
    
    if final_score < 20: 
        verdict = "FRAUD"
        tier = "critical"
    elif final_score < 50: 
        verdict = "REVIEW_NEEDED"
        tier = "high"
    elif final_score < 75:
        verdict = "MODERATE_RISK"
        tier = "moderate"
    else: 
        verdict = "LEGITIMATE"
        tier = "safe"
        
    result = {
        "final_score": final_score,
        "verdict": verdict,
        "tier": tier,
        "reasons": all_reasons,
        "breakdown": {
            "rule_score": rule_res["rule_score"],
            "ml_score": ml_res["fraud_score"],
            "llm_score": 0
        }
    }
    
    txn_data = {"amount": amount, "velocity": velocity, "hour": hour, "geo_distance": geo_distance}
    fraud_repo.create(db, txn_data, result, user_id=user_id)
    return result
