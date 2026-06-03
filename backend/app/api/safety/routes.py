from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from app.models.user import User
from app.models.ride import Ride
from app.models.alert import Alert
from app.models.gps_log import GPSLog
from app.ml.risk_score.calculator import compute_risk_score
from app.extensions import socketio
import redis
import json
import os

safety_bp = Blueprint("safety", __name__)

_redis = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
GPS_WINDOW = 10  # sliding window size


@safety_bp.route("/gps-ping", methods=["POST"])
@jwt_required()
def gps_ping():
    """Driver sends a GPS ping every ~30 seconds."""
    user_id = get_jwt_identity()
    driver  = User.objects(id=user_id).first()
    if not driver or driver.role != "driver":
        return jsonify({"error": "Driver access only"}), 403

    data = request.get_json()
    required = ["ride_id", "lat", "lng"]
    if not all(k in data for k in required):
        return jsonify({"error": "ride_id, lat, lng are required"}), 400

    ride = Ride.objects(id=data["ride_id"]).first()
    if not ride or ride.status != "active":
        return jsonify({"error": "No active ride found"}), 404

    # Save to MongoDB
    log = GPSLog(
        ride_id=ride,
        driver_id=driver,
        lat=data["lat"],
        lng=data["lng"],
        speed_kmh=data.get("speed_kmh", 0.0),
        heading=data.get("heading", 0.0),
        timestamp=datetime.utcnow(),
    )
    log.save()

    # Cache in Redis for Celery worker
    key = f"gps_window:{user_id}"
    ping = {
        "lat": data["lat"], "lng": data["lng"],
        "speed_kmh": data.get("speed_kmh", 0.0),
        "heading": data.get("heading", 0.0),
        "ts": datetime.utcnow().isoformat(),
    }
    _redis.rpush(key, json.dumps(ping))
    _redis.ltrim(key, -GPS_WINDOW, -1)  # keep last 10 pings
    _redis.expire(key, 3600)

    # Trigger async anomaly scoring
    from app.tasks.celery_tasks import score_gps_window
    score_gps_window.delay(user_id, str(ride.id))

    return jsonify({"message": "GPS ping recorded"}), 200


@safety_bp.route("/risk-score/<driver_id>", methods=["GET"])
@jwt_required()
def risk_score(driver_id):
    """Pre-trip risk score for a given driver."""
    driver = User.objects(id=driver_id).first()
    if not driver:
        return jsonify({"error": "Driver not found"}), 404

    score, label = compute_risk_score(driver_id)
    return jsonify({
        "driver_id": driver_id,
        "risk_score": score,
        "risk_label": label,
        "breakdown": {
            "anomaly_rate_weight": 0.40,
            "rating_weight": 0.30,
            "time_of_day_weight": 0.15,
            "zone_risk_weight": 0.15,
        }
    }), 200


@safety_bp.route("/alerts", methods=["GET"])
@jwt_required()
def list_alerts():
    """Admin: list all unresolved anomaly alerts."""
    user = User.objects(id=get_jwt_identity()).first()
    if not user or user.role != "admin":
        return jsonify({"error": "Admin access only"}), 403

    alerts = Alert.objects(resolved=False).order_by("-created_at").limit(100)
    return jsonify([a.to_json_safe() for a in alerts]), 200


@safety_bp.route("/alerts/<alert_id>/resolve", methods=["PATCH"])
@jwt_required()
def resolve_alert(alert_id):
    user = User.objects(id=get_jwt_identity()).first()
    if not user or user.role != "admin":
        return jsonify({"error": "Admin access only"}), 403

    alert = Alert.objects(id=alert_id).first()
    if not alert:
        return jsonify({"error": "Alert not found"}), 404

    alert.update(resolved=True, resolved_by=user)
    return jsonify({"message": "Alert resolved", "alert_id": alert_id}), 200
