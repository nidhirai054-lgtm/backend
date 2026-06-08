"""
Rating endpoints.

POST /api/rides/<ride_id>/rate
  Allows either the passenger or driver to rate the other party
  after a completed ride.

  Body: { "rating": 4.5, "review": "Optional text" }

  Logic:
    - Passenger calling → rates the driver (updates driver.avg_rating)
    - Driver calling    → rates the passenger (updates passenger reputation_score)
    - Emits "rating_received" socket event to the rated user's room
    - Each party can only rate once per ride
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.ride import Ride
from datetime import datetime

ratings_bp = Blueprint("ratings", __name__)


def _get_current_user():
    return User.objects(id=get_jwt_identity()).first()


def _recalculate_avg_rating(user_id: str) -> float:
    """
    Recalculate a driver's avg_rating from their last 100 completed rides.
    Falls back to the existing value if no rated rides exist.
    """
    rated_rides = Ride.objects(
        driver_id=user_id,
        status="completed",
        passenger_rating__ne=None,
    ).order_by("-completed_at").limit(100)

    ratings = [r.passenger_rating for r in rated_rides if r.passenger_rating is not None]
    if not ratings:
        return None

    return round(sum(ratings) / len(ratings), 2)


@ratings_bp.route("/<ride_id>/rate", methods=["POST"])
@jwt_required()
def rate_ride(ride_id):
    """
    Rate the other party in a completed ride.
    Passenger rates the driver; driver rates the passenger.
    """
    try:
        user = _get_current_user()
        if not user:
            return jsonify({"error": "User not found"}), 404

        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return jsonify({"error": "Ride not found"}), 404

        if ride.status != "completed":
            return jsonify({"error": "Can only rate completed rides"}), 400

        data = request.get_json() or {}
        rating = data.get("rating")
        review = data.get("review", "")

        if rating is None:
            return jsonify({"error": "rating is required"}), 400

        rating = float(rating)
        if not (1.0 <= rating <= 5.0):
            return jsonify({"error": "Rating must be between 1 and 5"}), 400

        passenger_id = str(ride.passenger_id.id) if hasattr(ride.passenger_id, "id") else str(ride.passenger_id)
        driver_id    = str(ride.driver_id.id)    if ride.driver_id and hasattr(ride.driver_id, "id") else (str(ride.driver_id) if ride.driver_id else None)
        caller_id    = str(user.id)

        from app.extensions import socketio

        if caller_id == passenger_id:
            # Passenger rating the driver
            if ride.passenger_rating is not None:
                return jsonify({"error": "You have already rated this ride"}), 409

            if not driver_id:
                return jsonify({"error": "No driver assigned to this ride"}), 400

            ride.passenger_rating = rating
            ride.passenger_review = review
            ride.rated_at = datetime.utcnow()
            ride.save()

            # Update driver's rolling avg_rating
            new_avg = _recalculate_avg_rating(driver_id)
            if new_avg is not None:
                User.objects(id=driver_id).update_one(set__avg_rating=new_avg)

            # Notify driver
            socketio.emit("rating_received", {
                "ride_id": ride_id,
                "rating":  rating,
                "review":  review,
                "from":    "passenger",
            }, room=f"passenger_{driver_id}")

            return jsonify({
                "message": "Driver rated successfully",
                "rating":  rating,
                "new_driver_avg_rating": new_avg,
            }), 200

        elif caller_id == driver_id:
            # Driver rating the passenger
            if ride.driver_rating is not None:
                return jsonify({"error": "You have already rated this ride"}), 409

            ride.driver_rating = rating
            ride.rated_at = datetime.utcnow()
            ride.save()

            # Update passenger reputation_score (simple rolling avg of last 50)
            rated_as_passenger = Ride.objects(
                passenger_id=passenger_id,
                status="completed",
                driver_rating__ne=None,
            ).order_by("-completed_at").limit(50)

            scores = [r.driver_rating for r in rated_as_passenger if r.driver_rating is not None]
            if scores:
                new_rep = round(sum(scores) / len(scores), 2)
                User.objects(id=passenger_id).update_one(set__reputation_score=new_rep)

            # Notify passenger
            socketio.emit("rating_received", {
                "ride_id": ride_id,
                "rating":  rating,
                "from":    "driver",
            }, room=f"passenger_{passenger_id}")

            return jsonify({
                "message": "Passenger rated successfully",
                "rating":  rating,
            }), 200

        else:
            return jsonify({"error": "You are not a participant in this ride"}), 403

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
