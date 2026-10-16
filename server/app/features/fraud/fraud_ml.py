import numpy as np
from sklearn.ensemble import IsolationForest

_fraud_model = None

def get_fraud_model():
    """
    Returns a trained Isolation Forest model for transactions.
    Trains on synthetic transaction data on first load.
    """
    global _fraud_model
    if _fraud_model is not None:
        return _fraud_model

    # Synthetic normal transactions
    # [amount, velocity (tx/hr), hour_of_day, geo_distance_km]
    X_train = []
    
    # Normal behavior (bulk of data)
    for _ in range(500):
        amount = np.random.normal(50, 20) # $50 average
        velocity = np.random.poisson(1) # 1 tx per hour
        hour = np.random.randint(6, 23) # Daytime
        geo = np.random.exponential(10) # close by
        X_train.append([max(0, amount), velocity, hour, geo])
        
    # Introduce some anomalies (fraudulent behavior)
    for _ in range(20):
        amount = np.random.uniform(500, 5000) # high amount
        velocity = np.random.poisson(10) # high velocity
        hour = np.random.randint(0, 5) # night time
        geo = np.random.uniform(500, 5000) # far away
        X_train.append([amount, velocity, hour, geo])
        
    # contamination = expected % of anomalies
    _fraud_model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    _fraud_model.fit(X_train)
    return _fraud_model

def predict_transaction_fraud(amount: float, velocity: int, hour: int, geo_distance: float) -> dict:
    """
    Scores a transaction using Isolation Forest with calibrated score mapping.
    """
    model = get_fraud_model()
    
    features = [[amount, velocity, hour, geo_distance]]
    
    # Decision function returns a raw score (positive for inliers, negative for outliers)
    raw_score = float(model.decision_function(features)[0])
    
    # Calibrated mapping:
    # High inlier (raw_score >= 0.08): 0 risk
    # Mild inlier (0.00 <= raw_score < 0.08): 0 - 15 risk
    # Mild anomaly (-0.15 <= raw_score < 0.00): 15 - 60 risk
    # Severe anomaly (raw_score < -0.15): 60 - 100 risk
    if raw_score >= 0.08:
        risk_score = 0
    elif raw_score >= 0.00:
        risk_score = int((0.08 - raw_score) / 0.08 * 15)
    elif raw_score >= -0.15:
        risk_score = int(15 + (-raw_score) / 0.15 * 45)
    else:
        risk_score = int(min(100, 60 + (-raw_score - 0.15) / 0.15 * 40))

    risk_score = 100 - max(0, min(100, risk_score))
    
    reasons = []
    if amount > 300:
        reasons.append("Unusually high transaction amount")
    if velocity > 5:
        reasons.append("High transaction velocity (multiple transactions in short timeframe)")
    if hour < 5 or hour > 23:
        reasons.append("Transaction occurred at an unusual hour")
    if geo_distance > 100:
        reasons.append("Device location is far from usual billing/shipping area")
        
    return {
        "fraud_score": risk_score,
        "fraud_reasons": reasons
    }
