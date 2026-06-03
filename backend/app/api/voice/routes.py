from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.ml.voice.ner import extract_booking_entities
from app.models.user import User
from app.models.ride import Ride
from app.utils.geo import haversine_km
from app.utils.carbon import calculate_co2_saved, calculate_green_points
from app.ml.risk_score.calculator import compute_risk_score

voice_bp = Blueprint("voice", __name__)


@voice_bp.route("/process", methods=["POST"])
@jwt_required()
def process_voice():
    """
    Accepts a voice transcript from Web Speech API,
    runs spaCy NER to extract booking entities and books the ride.
    """
    data = request.get_json()
    transcript = data.get("transcript", "").strip()
    auto_book = data.get("auto_book", True)

    if not transcript:
        return jsonify({"error": "Transcript is required"}), 400

    entities = extract_booking_entities(transcript)
    ready_to_book = bool(entities.get("pickup") and entities.get("dropoff"))

    if not ready_to_book or not auto_book:
        return jsonify({
            "transcript": transcript,
            "entities": entities,
            "ready_to_book": ready_to_book,
            "message": "Could not fully extract booking details — please repeat",
        }), 200

    # Book the ride automatically
    try:
        user = User.objects(id=get_jwt_identity()).first()
        if not user or user.role != "passenger":
            return jsonify({"error": "Passengers only"}), 403

        pickup_loc = entities["pickup"]
        dropoff_loc = entities["dropoff"]
        ride_type = entities.get("ride_type", "solo")

        # Create pickup/dropoff dicts with placeholder coordinates
        pickup = {"lat": 12.9716, "lng": 77.5946, "address": pickup_loc}  # Bangalore coords
        dropoff = {"lat": 12.9716, "lng": 77.5946, "address": dropoff_loc}

        # Estimate distance (placeholder: 5km)
        distance_km = 5.0
        base_rate = 12.0
        fare = round(distance_km * base_rate, 2)

        # Find driver
        from app.api.rides.routes import _match_driver
        driver = _match_driver(ride_type, False, user, 12.9716, 77.5946)

        risk_score, risk_label = (0.0, "green")
        if driver:
            risk_score, risk_label = compute_risk_score(str(driver.id))

        co2_saved = calculate_co2_saved(distance_km, ride_type, 1)
        green_pts = calculate_green_points(ride_type)

        ride = Ride(
            passenger_id=user,
            driver_id=driver,
            pickup=pickup,
            dropoff=dropoff,
            status="pending" if not driver else "active",
            ride_type=ride_type,
            risk_score=risk_score,
            risk_label=risk_label,
            co2_saved=co2_saved,
            green_points_awarded=green_pts,
            fare=fare,
            distance_km=distance_km,
            women_only=False,
            pool_passengers=1,
        )
        ride.save()

        if green_pts > 0:
            User.objects(id=user.id).update_one(inc__green_points=green_pts)

        return jsonify({
            "transcript": transcript,
            "entities": entities,
            "ready_to_book": True,
            "message": "Ride booked successfully via voice",
            "ride": ride.to_json_safe(),
            "driver": driver.to_json_safe() if driver else None,
        }), 201
    except Exception as e:
        return jsonify({
            "transcript": transcript,
            "entities": entities,
            "error": f"Failed to book ride: {str(e)}",
        }), 500
