"""
GPS anomaly scoring using the trained Isolation Forest model.
"""

import os
import pickle
import numpy as np
from typing import List, Dict, Tuple
from app.utils.geo import haversine_km, heading_change

BASE_DIR  = os.path.dirname(__file__)
MODEL_DIR = os.path.join(BASE_DIR, "model")

_model  = None
_scaler = None

ANOMALY_THRESHOLD = -0.15  # scores below this trigger an alert


def _load():
    global _model, _scaler
    if _model is not None:
        return

    model_path  = os.path.join(MODEL_DIR, "isolation_forest.pkl")
    scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")

    if not os.path.exists(model_path):
        return   # model not trained yet

    with open(model_path, "rb") as f:
        _model = pickle.load(f)
    with open(scaler_path, "rb") as f:
        _scaler = pickle.load(f)


def _build_feature_vector(pings: List[Dict]) -> np.ndarray:
    """
    Convert a sliding window of GPS pings into a single feature vector.
    Features: speed, heading_change, stop_duration, route_deviation, time_bucket, dist_prev
    """
    speeds, h_changes, stops, deviations, dist_prevs = [], [], [], [], []

    for i, ping in enumerate(pings):
        speeds.append(ping.get("speed_kmh", 0.0))
        stops.append(ping.get("stop_duration_s", 0.0))

        if i > 0:
            prev = pings[i - 1]
            h_changes.append(heading_change(prev.get("heading", 0.0), ping.get("heading", 0.0)))
            d = haversine_km(prev["lat"], prev["lng"], ping["lat"], ping["lng"])
            dist_prevs.append(d)
            deviations.append(ping.get("route_deviation_m", d * 1000))
        else:
            h_changes.append(0.0)
            dist_prevs.append(0.0)
            deviations.append(0.0)

    from datetime import datetime
    last_ts = pings[-1].get("ts", "")
    try:
        hour = datetime.fromisoformat(last_ts).hour
    except Exception:
        hour = 12

    return np.array([[
        np.mean(speeds),
        np.mean(h_changes),
        np.mean(stops),
        np.mean(deviations),
        hour,
        np.mean(dist_prevs),
    ]])


def score_window(pings: List[Dict]) -> Tuple[float, bool, str]:
    """
    Score a window of GPS pings.
    Returns (anomaly_score, is_anomalous, alert_type)
    """
    _load()

    if _model is None or len(pings) < 3:
        return 0.0, False, ""

    X = _build_feature_vector(pings)
    X_scaled = _scaler.transform(X)

    score = float(_model.decision_function(X_scaled)[0])
    is_anomalous = score < ANOMALY_THRESHOLD

    # Classify alert type
    alert_type = ""
    if is_anomalous:
        avg_speed   = np.mean([p.get("speed_kmh", 0) for p in pings])
        avg_heading = np.mean([heading_change(
            pings[i - 1].get("heading", 0), p.get("heading", 0))
            for i, p in enumerate(pings) if i > 0] or [0])

        if avg_speed < 2.0:
            alert_type = "unusual_stop"
        elif avg_speed > 90:
            alert_type = "speed_violation"
        else:
            alert_type = "route_deviation"

    return score, is_anomalous, alert_type
