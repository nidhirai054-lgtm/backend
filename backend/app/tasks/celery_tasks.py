"""
Celery background tasks.
Primary task: score_gps_window — runs every time a GPS ping is received.
"""

import json
import os
import redis

from app.extensions import celery
from app.ml.anomaly.predict import score_window

_redis = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))


@celery.task(name="tasks.score_gps_window")
def score_gps_window(driver_id: str, ride_id: str):
    """
    Pull the sliding window of GPS pings from Redis,
    score with Isolation Forest, and emit Socket.io alert if anomalous.
    """
    key = f"gps_window:{driver_id}"
    raw_pings = _redis.lrange(key, 0, -1)

    if not raw_pings:
        return

    pings = [json.loads(p) for p in raw_pings]

    anomaly_score, is_anomalous, alert_type = score_window(pings)

    if is_anomalous:
        _handle_anomaly(driver_id, ride_id, anomaly_score, alert_type)


def _handle_anomaly(driver_id: str, ride_id: str, score: float, alert_type: str):
    """Save alert to DB and push Socket.io event."""
    from app.models.alert import Alert
    from app.models.ride import Ride
    from app.models.user import User
    from app.extensions import socketio

    driver = User.objects(id=driver_id).first()
    ride   = Ride.objects(id=ride_id).first()

    if not driver or not ride:
        return

    # Avoid duplicate unresolved alerts for same ride
    existing = Alert.objects(ride_id=ride, resolved=False).first()
    if existing:
        return

    alert = Alert(
        ride_id=ride,
        driver_id=driver,
        alert_type=alert_type,
        anomaly_score=score,
    )
    alert.save()

    payload = {
        "alert_id":    str(alert.id),
        "ride_id":     ride_id,
        "driver_id":   driver_id,
        "driver_name": driver.name,
        "alert_type":  alert_type,
        "score":       score,
    }

    # Emit to passenger room and admin room
    passenger_id = str(ride.passenger_id.id) if ride.passenger_id else None
    if passenger_id:
        socketio.emit("safety_alert", payload, room=f"passenger_{passenger_id}")
    socketio.emit("safety_alert", payload, room="admin")
