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


@safety_bp.route("/sos", methods=["POST"])
@jwt_required()
def trigger_sos():
    """
    REST fallback for passenger SOS trigger.
    Expected JSON: {"ride_id": "...", "lat": 12.34, "lng": 56.78}
    """
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    ride_id = data.get("ride_id")
    lat = data.get("lat")
    lng = data.get("lng")
    notify_contacts = data.get("notify_contacts", True)
    notify_police   = data.get("notify_police", True)

    if not ride_id:
        return jsonify({"error": "ride_id is required"}), 400

    ride = Ride.objects(id=ride_id).first()
    if not ride:
        return jsonify({"error": "Ride not found"}), 404

    passenger = User.objects(id=user_id).first()
    driver = User.objects(id=ride.driver_id.id).first() if ride.driver_id else None

    alert = Alert(
        ride_id=ride,
        driver_id=driver or ride.driver_id,
        alert_type="sos",
        anomaly_score=1.0,
        notified_contacts=notify_contacts,
        notified_police=notify_police,
    )
    alert.save()

    from app.api.safety.sms import build_whatsapp_sos_message, build_location_url, alert_police_control_room
    from app.tasks.celery_tasks import log_sos_event_task
    location_url = build_location_url(lat, lng) if lat and lng else "Location unavailable"
    passenger_name = passenger.name if passenger else "A passenger"

    pickup_addr = ride.pickup.get("address", "Unknown Pickup")
    dropoff_addr = ride.dropoff.get("address", "Unknown Dropoff")
    d_name = driver.name if driver else "Unknown"
    d_vehicle = driver.vehicle_type if driver and driver.vehicle_type else "Unknown Vehicle"
    
    whatsapp_body = build_whatsapp_sos_message(
        passenger_name=passenger_name,
        location_url=location_url,
        ride_id=str(ride.id),
        pickup=pickup_addr,
        dropoff=dropoff_addr,
        driver_name=d_name,
        driver_vehicle=d_vehicle
    )

    contacts_notified = 0
    if notify_contacts and passenger and passenger.emergency_contacts:
        for contact in passenger.emergency_contacts:
            if contact.notify_sms and contact.phone:
                log_sos_event_task.delay(contact.phone, whatsapp_body)
                contacts_notified += 1

    if notify_police:
        alert_police_control_room(str(ride.id), location_url)

    payload = {
        "alert_id": str(alert.id),
        "ride_id": ride_id,
        "driver_id": str(driver.id) if driver else None,
        "driver_name": driver.name if driver else "Unknown",
        "alert_type": "sos",
        "score": 1.0,
        "pickup": ride.pickup,
        "dropoff": ride.dropoff,
        "created_at": alert.created_at.isoformat(),
        "lat": lat,
        "lng": lng,
    }

    # Notify admin via socket
    socketio.emit("sos_triggered", payload, room="admin")
    socketio.emit("safety_alert", payload, room="admin")

    return jsonify({
        "message": "SOS triggered successfully",
        "alert_id": str(alert.id),
        "contacts_notified": contacts_notified,
        "notified_police": notify_police,
        "location_link": location_url,
        "whatsapp_message": whatsapp_body if notify_contacts else None,
        "emergency_contacts": [c.to_dict() for c in (passenger.emergency_contacts or [])] if passenger else []
    }), 200

