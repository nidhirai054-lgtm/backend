from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.ride import Ride
from app.models.community import Community
from app.utils.geo import haversine_km
from app.utils.carbon import calculate_co2_saved, calculate_green_points
from app.ml.risk_score.calculator import compute_risk_score
from app.services.routing import calculate_route, calculate_fare, calculate_surge_multiplier

rides_bp = Blueprint("rides", __name__)

# Register rating sub-routes
from app.api.rides.ratings import ratings_bp  # noqa: E402
rides_bp.register_blueprint(ratings_bp)


def _get_current_user():
    return User.objects(id=get_jwt_identity()).first()


@rides_bp.route("/available", methods=["GET"])
@jwt_required()
def available_rides():
    """
    Driver polls this to see unassigned rides near their location.
    Returns rides in 'searching' status within 15km of the driver.
    """
    driver = _get_current_user()
    if not driver or driver.role != "driver":
        return jsonify({"error": "Driver access only"}), 403

    # Update driver's location if passed in query parameters
    lat_param = request.args.get("lat")
    lng_param = request.args.get("lng")
    if lat_param is not None and lng_param is not None:
        try:
            driver.last_lat = float(lat_param)
            driver.last_lng = float(lng_param)
            driver.save()
        except ValueError:
            pass

    # Get all searching rides (no driver assigned yet)
    rides = Ride.objects(status="searching", driver_id=None).order_by("-created_at").limit(20)

    result = []
    for ride in rides:
        try:
            dist = haversine_km(
                driver.last_lat, driver.last_lng,
                ride.pickup["lat"], ride.pickup["lng"]
            )
            if dist <= 15.0:
                ride_data = ride.to_json_safe()
                ride_data["distance_to_pickup_km"] = round(dist, 2)
                result.append(ride_data)
        except Exception:
            continue

    # Sort by proximity
    result.sort(key=lambda r: r.get("distance_to_pickup_km", 99))
    return jsonify(result), 200


@rides_bp.route("/estimate", methods=["POST"])
@jwt_required()
def estimate_ride():
    """Get fare estimate before booking"""
    try:
        data = request.get_json()
        
        pickup = data.get('pickup')
        dropoff = data.get('dropoff')
        ride_type = data.get('ride_type', 'solo')
        
        if not pickup or not dropoff:
            return jsonify({"error": "Pickup and dropoff required"}), 400
        
        pickup_lat = float(pickup.get('lat'))
        pickup_lng = float(pickup.get('lng'))
        dropoff_lat = float(dropoff.get('lat'))
        dropoff_lng = float(dropoff.get('lng'))
        
        # Calculate route
        route = calculate_route(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        
        # Calculate surge
        surge = calculate_surge_multiplier(pickup_lat, pickup_lng)
        
        # Calculate fare
        fare_breakdown = calculate_fare(
            route['distance_meters'],
            route['duration_seconds'],
            ride_type,
            surge
        )
        
        return jsonify({
            'route': route,
            'fare': fare_breakdown,
            'eta_minutes': route['duration_seconds'] // 60,
            'distance_km': route['distance_meters'] / 1000
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@rides_bp.route("/book", methods=["POST"])
@jwt_required()
def book_ride():
    try:
        user_id = get_jwt_identity()
        print(f"DEBUG: JWT user_id = {user_id}, type = {type(user_id)}")
        
        user = User.objects(id=user_id).first()
        print(f"DEBUG: User found = {user}")
        
        if not user:
            return jsonify({"error": "User not found. Please login again."}), 404
        
        if user.role != "passenger":
            return jsonify({"error": f"Only passengers can book rides. Your role: {user.role}"}), 403

        active_statuses = ["searching", "driver_assigned", "driver_arriving", "in_progress"]
        existing_ride = Ride.objects(passenger_id=user, status__in=active_statuses).first()
        if existing_ride:
            return jsonify({
                "error": "You already have an active ride",
                "ride_id": str(existing_ride.id),
                "status": existing_ride.status
            }), 409

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        required = ["pickup", "dropoff", "ride_type"]
        if not all(k in data for k in required):
            return jsonify({"error": "Missing fields: pickup, dropoff, ride_type"}), 400

        pickup  = data["pickup"]
        dropoff = data["dropoff"]
        ride_type   = data["ride_type"]
        women_only  = data.get("women_only", False)
        pool_passengers = data.get("pool_passengers", 1)

        # Validate pickup/dropoff structure
        if not isinstance(pickup, dict) or not isinstance(dropoff, dict):
            return jsonify({"error": "pickup and dropoff must be objects"}), 400
        
        # Get coordinates
        pickup_lat = float(pickup.get("lat"))
        pickup_lng = float(pickup.get("lng"))
        dropoff_lat = float(dropoff.get("lat"))
        dropoff_lng = float(dropoff.get("lng"))
        
        # Ensure address field exists
        if "address" not in pickup:
            pickup["address"] = "Pickup Location"
        if "address" not in dropoff:
            dropoff["address"] = "Dropoff Location"

        # Calculate route using routing service
        route = calculate_route(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        
        # Calculate surge
        surge = calculate_surge_multiplier(pickup_lat, pickup_lng)
        
        # Calculate fare
        fare_breakdown = calculate_fare(
            route['distance_meters'],
            route['duration_seconds'],
            ride_type,
            surge
        )
        
        distance_km = route['distance_meters'] / 1000

        # CO₂ & green points
        co2_saved = calculate_co2_saved(distance_km, ride_type, pool_passengers)
        green_pts  = calculate_green_points(ride_type)

        ride = Ride(
            passenger_id=user,
            driver_id=None,
            pickup=pickup,
            dropoff=dropoff,
            status="searching",
            ride_type=ride_type,
            risk_score=0.0,
            risk_label="green",
            co2_saved=co2_saved,
            green_points_awarded=green_pts,
            fare=fare_breakdown['total'],
            distance_km=distance_km,
            estimated_duration_minutes=route['duration_seconds'] // 60,
            route_polyline=route.get('polyline'),
            surge_multiplier=surge,
            women_only=women_only,
            pool_passengers=pool_passengers,
        )
        ride.save()

        # Award green points to user
        if green_pts > 0:
            User.objects(id=user.id).update_one(inc__green_points=green_pts)

        # Notify all online drivers immediately
        from app.extensions import socketio
        socketio.emit("new_ride_available", ride.to_json_safe(), room="drivers")

        return jsonify({
            "message": "Ride booked! Waiting for a driver to accept.",
            "ride": ride.to_json_safe(),
            "driver": None,
            "route": route,
            "fare_breakdown": fare_breakdown
        }), 201
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@rides_bp.route("/", methods=["GET"])
@jwt_required()
def list_rides():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    if user.role == "passenger":
        rides = Ride.objects(passenger_id=user).order_by("-created_at").limit(20)
    elif user.role == "driver":
        rides = Ride.objects(driver_id=user).order_by("-created_at").limit(20)
    else:
        rides = Ride.objects().order_by("-created_at").limit(50)

    return jsonify([r.to_json_safe() for r in rides]), 200


@rides_bp.route("/<ride_id>", methods=["GET"])
@jwt_required()
def get_ride(ride_id):
    ride = Ride.objects(id=ride_id).first()
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    return jsonify(ride.to_json_safe()), 200


@rides_bp.route("/cancel/<ride_id>", methods=["POST"])
@jwt_required()
def cancel_ride(ride_id):
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    ride = Ride.objects(id=ride_id).first()
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    if str(ride.passenger_id.id) != str(user.id) and user.role != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    if ride.status in ["completed", "cancelled"]:
        return jsonify({"error": f"Ride already {ride.status}"}), 400

    ride.update(status="cancelled")
    return jsonify({"message": "Ride cancelled", "ride_id": ride_id}), 200


@rides_bp.route("/match", methods=["GET"])
@jwt_required()
def match_driver():
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    ride_type  = request.args.get("ride_type", "solo")
    women_only = request.args.get("women_only", "false").lower() == "true"
    lat = float(request.args.get("lat", 0))
    lng = float(request.args.get("lng", 0))
    driver = _match_driver(ride_type, women_only, user, lat, lng)
    if not driver:
        return jsonify({"message": "No drivers available", "driver": None}), 200
    risk_score, risk_label = compute_risk_score(str(driver.id))
    return jsonify({
        "driver": driver.to_json_safe(),
        "risk_score": risk_score,
        "risk_label": risk_label,
    }), 200


# ── Internal helper ────────────────────────────────────────────────────────────
def _match_driver(ride_type: str, women_only: bool, passenger: User, lat: float = None, lng: float = None):
    """Find an available driver with proximity and community filters."""
    query = {"role": "driver", "is_active": True}
    if women_only:
        query["gender"] = "female"
    if ride_type == "EV":
        query["vehicle_type"] = "EV"

    drivers = User.objects(**query)
    
    match_list = []
    for d in drivers:
        # Distance filter (max 10km)
        dist = 0.0
        if lat is not None and lng is not None:
            dist = haversine_km(lat, lng, d.last_lat, d.last_lng)
            if dist > 10.0:
                continue
        
        # Community score (prioritize same community)
        community_match = 1 if (passenger.community_id and d.community_id and 
                                passenger.community_id.id == d.community_id.id) else 0
        
        match_list.append({
            "driver": d,
            "distance": dist,
            "community_match": community_match,
            # Priority: Community match first, then distance
            "score": community_match * 100 - dist 
        })

    if not match_list:
        return None

    # Sort by score descending
    match_list.sort(key=lambda x: x["score"], reverse=True)
    return match_list[0]["driver"]


@rides_bp.route("/<ride_id>/status", methods=["GET"])
@jwt_required()
def get_ride_status(ride_id):
    """Get current ride status and driver location"""
    try:
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return jsonify({"error": "Ride not found"}), 404
        
        user = _get_current_user()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Check authorization
        is_passenger = str(ride.passenger_id.id) == str(user.id)
        is_driver = ride.driver_id and str(ride.driver_id.id) == str(user.id)
        is_admin = user.role == "admin"
        
        if not (is_passenger or is_driver or is_admin):
            return jsonify({"error": "Unauthorized"}), 403
        
        response = {
            "ride_id": str(ride.id),
            "status": ride.status,
            "driver_location": ride.driver_current_location,
            "eta_minutes": ride.actual_eta_minutes,
            "pickup": ride.pickup,
            "dropoff": ride.dropoff,
            "fare": ride.fare,
            "distance_km": ride.distance_km
        }
        
        if ride.driver_id:
            driver = User.objects(id=ride.driver_id.id).first()
            if driver:
                response["driver"] = driver.to_json_safe()
        
        return jsonify(response), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@rides_bp.route("/<ride_id>/driver-location", methods=["GET"])
@jwt_required()
def get_driver_location(ride_id):
    """Get real-time driver location for a ride"""
    try:
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return jsonify({"error": "Ride not found"}), 404

        if not ride.driver_current_location:
            return jsonify({"error": "Driver location not available"}), 404

        return jsonify({
            "ride_id": str(ride.id),
            "driver_location": ride.driver_current_location,
            "eta_minutes": ride.actual_eta_minutes,
            "status": ride.status
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@rides_bp.route("/<ride_id>/accept", methods=["PATCH"])
@jwt_required()
def accept_ride(ride_id):
    """
    Driver accepts a ride in 'searching' status, self-assigning as the driver.
    Updates status to 'driver_assigned' and notifies the passenger via socket.
    """
    try:
        driver = _get_current_user()
        if not driver or driver.role != "driver":
            return jsonify({"error": "Driver access only"}), 403

        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return jsonify({"error": "Ride not found"}), 404

        if ride.status != "searching":
            return jsonify({"error": f"Ride is not available (status: {ride.status})"}), 400

        if ride.driver_id:
            return jsonify({"error": "Ride already has a driver"}), 400

        # Assign driver and advance status
        ride.driver_id = driver
        ride.status = "driver_assigned"
        ride.save()

        # Notify passenger in real-time
        from app.extensions import socketio
        from app.utils.push import send_push
        passenger_id = str(ride.passenger_id.id)
        socketio.emit("ride_status_changed", {
            "ride_id": str(ride.id),
            "status": "driver_assigned",
            "driver": driver.to_json_safe(),
        }, room=f"passenger_{passenger_id}")

        # Push notification to passenger (works when tab is in background)
        send_push(
            user_id=passenger_id,
            title="Driver Found! 🚗",
            body=f"{driver.name} accepted your ride and is on the way.",
            url="/",
        )

        return jsonify({
            "message": "Ride accepted",
            "ride": ride.to_json_safe(),
            "driver": driver.to_json_safe(),
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@rides_bp.route("/<ride_id>/update-status", methods=["PATCH"])
@jwt_required()
def driver_update_status(ride_id):
    """
    Driver advances the ride lifecycle.
    Valid transitions:
      driver_assigned → driver_arriving  (driver sets off toward pickup)
      driver_arriving → in_progress      (passenger on board, trip started)
      in_progress     → completed        (trip finished at dropoff)
      any active      → cancelled        (driver cancels)
    Emits ride_status_changed to the passenger's socket room.
    """
    try:
        driver = _get_current_user()
        if not driver or driver.role != "driver":
            return jsonify({"error": "Driver access only"}), 403

        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return jsonify({"error": "Ride not found"}), 404

        # Verify this driver owns the ride
        if not ride.driver_id or str(ride.driver_id.id) != str(driver.id):
            return jsonify({"error": "You are not the driver for this ride"}), 403

        new_status = request.get_json().get("status")
        if not new_status:
            return jsonify({"error": "status is required"}), 400

        valid_transitions = {
            "driver_assigned": ["driver_arriving", "cancelled"],
            "driver_arriving": ["in_progress", "cancelled"],
            "in_progress":     ["completed"],
        }

        allowed = valid_transitions.get(ride.status, [])
        if new_status not in allowed:
            return jsonify({
                "error": f"Cannot transition from '{ride.status}' to '{new_status}'",
                "allowed": allowed,
            }), 400

        ride.status = new_status
        if new_status == "completed":
            from datetime import datetime
            ride.completed_at = datetime.utcnow()
        ride.save()

        # Notify passenger in real-time
        from app.extensions import socketio
        from app.utils.push import send_push
        passenger_id = str(ride.passenger_id.id)
        socketio.emit("ride_status_changed", {
            "ride_id": str(ride.id),
            "status": new_status,
        }, room=f"passenger_{passenger_id}")

        # Push notification based on new status
        push_messages = {
            "driver_arriving": ("Driver On The Way 📍", "Your driver is heading to your pickup location."),
            "in_progress":     ("Ride Started 🚀", "You're on your way! Have a safe trip."),
            "completed":       ("Ride Completed ✅", f"Your trip is complete. Fare: ₹{ride.fare:.0f}. Please rate your driver!"),
        }
        if new_status in push_messages:
            title, body = push_messages[new_status]
            send_push(user_id=passenger_id, title=title, body=body, url="/")

        return jsonify({
            "message": f"Ride status updated to '{new_status}'",
            "ride": ride.to_json_safe(),
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
