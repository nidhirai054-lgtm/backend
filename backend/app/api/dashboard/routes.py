from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.ride import Ride
from app.models.alert import Alert
from app.models.gps_log import GPSLog
from app.models.community import Community
import redis, json, os

dashboard_bp = Blueprint("dashboard", __name__)
_redis = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))


@dashboard_bp.route("/stats", methods=["GET"])
@jwt_required()
def stats():
    user = User.objects(id=get_jwt_identity()).first()
    if not user or user.role != "admin":
        return jsonify({"error": "Admin access only"}), 403

    active_rides    = Ride.objects(status="active").count()
    pending_rides   = Ride.objects(status="pending").count()
    total_rides     = Ride.objects().count()
    open_alerts     = Alert.objects(resolved=False).count()
    total_users     = User.objects(role="passenger").count()
    total_drivers   = User.objects(role="driver").count()
    total_communities = Community.objects().count()

    # Green impact
    completed_rides = Ride.objects(status="completed")
    total_co2_saved  = sum(r.co2_saved for r in completed_rides)
    total_green_pts  = sum(r.green_points_awarded for r in completed_rides)

    return jsonify({
        "rides": {
            "active": active_rides,
            "pending": pending_rides,
            "total": total_rides,
        },
        "alerts": {"open": open_alerts},
        "users": {
            "passengers": total_users,
            "drivers": total_drivers,
        },
        "communities": total_communities,
        "green_impact": {
            "total_co2_saved_kg": round(total_co2_saved, 2),
            "total_green_points_distributed": total_green_pts,
        },
    }), 200


@dashboard_bp.route("/live-drivers", methods=["GET"])
@jwt_required()
def live_drivers():
    """Returns latest GPS position for all active drivers."""
    user = User.objects(id=get_jwt_identity()).first()
    if not user or user.role != "admin":
        return jsonify({"error": "Admin access only"}), 403

    active_drivers = User.objects(role="driver", is_active=True)
    result = []
    for driver in active_drivers:
        key = f"gps_window:{str(driver.id)}"
        pings = _redis.lrange(key, -1, -1)  # get last ping
        if pings:
            last_ping = json.loads(pings[0])
            result.append({
                "driver_id": str(driver.id),
                "name": driver.name,
                "lat": last_ping["lat"],
                "lng": last_ping["lng"],
                "speed_kmh": last_ping.get("speed_kmh", 0),
                "last_seen": last_ping.get("ts"),
            })

    return jsonify(result), 200
