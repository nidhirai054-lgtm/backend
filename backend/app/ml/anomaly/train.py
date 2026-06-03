"""
Train Isolation Forest on NYC Taxi-like GPS features.
Run: python -m app.ml.anomaly.train

Features (6):
  speed_kmh, heading_change, stop_duration_s,
  route_deviation_m, time_of_day_bucket, distance_from_prev_km
"""

import os
import pickle
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

BASE_DIR  = os.path.dirname(__file__)
MODEL_DIR = os.path.join(BASE_DIR, "model")
os.makedirs(MODEL_DIR, exist_ok=True)

N_SAMPLES = 50_000  # synthetic training data


def _generate_normal_gps_data(n: int) -> np.ndarray:
    """Generate synthetic normal GPS drive data."""
    rng = np.random.default_rng(42)
    speed          = rng.normal(35, 12, n).clip(0, 80)
    heading_change = rng.exponential(5, n).clip(0, 30)
    stop_duration  = rng.exponential(10, n).clip(0, 60)
    deviation      = rng.exponential(20, n).clip(0, 100)
    time_bucket    = rng.integers(0, 24, n)        # hour of day
    dist_prev      = rng.normal(0.3, 0.1, n).clip(0.01, 1.5)
    return np.column_stack([speed, heading_change, stop_duration, deviation, time_bucket, dist_prev])


def train():
    print("Generating training data...")
    X = _generate_normal_gps_data(N_SAMPLES)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print("Training Isolation Forest...")
    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    # Save
    with open(os.path.join(MODEL_DIR, "isolation_forest.pkl"), "wb") as f:
        pickle.dump(model, f)
    with open(os.path.join(MODEL_DIR, "scaler.pkl"), "wb") as f:
        pickle.dump(scaler, f)

    print(f"✅ Anomaly model saved to {MODEL_DIR}")


if __name__ == "__main__":
    train()
