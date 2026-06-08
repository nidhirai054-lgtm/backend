"""
Razorpay payment endpoints.

POST /api/payments/create-order
    Creates a Razorpay order for a completed/active ride.
    Returns { order_id, amount_paise, currency, key_id } for the frontend
    to open the Razorpay checkout modal.

POST /api/payments/verify
    Verifies the HMAC-SHA256 Razorpay payment signature.
    On success: marks Payment + Ride as paid.

GET  /api/payments/<ride_id>
    Returns the payment status for a ride.

Note: Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env
      Set VITE_RAZORPAY_KEY_ID in frontend/.env
"""

import hmac
import hashlib
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.ride import Ride
from app.models.payment import Payment
from datetime import datetime

payments_bp = Blueprint("payments", __name__)

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")


def _get_current_user():
    return User.objects(id=get_jwt_identity()).first()


def _get_razorpay_client():
    """Return a Razorpay client, or raise ImportError with a helpful message."""
    try:
        import razorpay
        return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except ImportError:
        raise ImportError(
            "razorpay package not installed. Run: pip install razorpay==1.4.2"
        )


@payments_bp.route("/create-order", methods=["POST"])
@jwt_required()
def create_order():
    """
    Create a Razorpay payment order for a ride.
    Returns the order_id needed to open the Razorpay checkout.
    """
    try:
        user = _get_current_user()
        if not user:
            return jsonify({"error": "User not found"}), 404

        data    = request.get_json() or {}
        ride_id = data.get("ride_id")
        if not ride_id:
            return jsonify({"error": "ride_id is required"}), 400

        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return jsonify({"error": "Ride not found"}), 404

        # Only the passenger can initiate payment
        passenger_id = str(ride.passenger_id.id) if hasattr(ride.passenger_id, "id") else str(ride.passenger_id)
        if str(user.id) != passenger_id:
            return jsonify({"error": "Only the passenger can pay for this ride"}), 403

        if ride.payment_status == "paid":
            existing = Payment.objects(ride_id=ride, status="paid").first()
            return jsonify({
                "message": "Ride already paid",
                "payment": existing.to_json_safe() if existing else None,
            }), 200

        # Check for no Razorpay keys (demo mode)
        if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
            return jsonify({
                "error": "Razorpay keys not configured",
                "hint":  "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env",
                "demo_mode": True,
            }), 503

        amount_paise = int(ride.fare * 100)  # convert ₹ to paise

        client = _get_razorpay_client()
        order = client.order.create({
            "amount":   amount_paise,
            "currency": "INR",
            "receipt":  f"ride_{ride_id}",
            "notes": {
                "ride_id":      ride_id,
                "passenger_id": str(user.id),
            },
        })

        # Persist the order
        payment = Payment(
            ride_id=ride,
            passenger_id=user,
            razorpay_order_id=order["id"],
            amount_paise=amount_paise,
        )
        payment.save()

        return jsonify({
            "order_id":     order["id"],
            "amount_paise": amount_paise,
            "amount_inr":   ride.fare,
            "currency":     "INR",
            "key_id":       RAZORPAY_KEY_ID,
            "ride":         ride.to_json_safe(),
        }), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@payments_bp.route("/verify", methods=["POST"])
@jwt_required()
def verify_payment():
    """
    Verify the Razorpay payment signature sent from the frontend after checkout.
    On success, marks the payment and ride as paid.
    """
    try:
        data = request.get_json() or {}
        razorpay_order_id   = data.get("razorpay_order_id")
        razorpay_payment_id = data.get("razorpay_payment_id")
        razorpay_signature  = data.get("razorpay_signature")
        ride_id             = data.get("ride_id")

        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature, ride_id]):
            return jsonify({"error": "razorpay_order_id, razorpay_payment_id, razorpay_signature, ride_id all required"}), 400

        # Verify HMAC-SHA256 signature
        expected_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode("utf-8"),
            f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_signature, razorpay_signature):
            # Mark payment as failed
            Payment.objects(razorpay_order_id=razorpay_order_id).update_one(
                set__status="failed"
            )
            return jsonify({"error": "Signature verification failed"}), 400

        # Mark payment as paid
        now = datetime.utcnow()
        Payment.objects(razorpay_order_id=razorpay_order_id).update_one(
            set__razorpay_payment_id=razorpay_payment_id,
            set__razorpay_signature=razorpay_signature,
            set__status="paid",
            set__paid_at=now,
        )

        # Mark ride as paid
        Ride.objects(id=ride_id).update_one(set__payment_status="paid")

        payment = Payment.objects(razorpay_order_id=razorpay_order_id).first()

        return jsonify({
            "success": True,
            "message": "Payment verified and recorded",
            "payment": payment.to_json_safe() if payment else None,
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@payments_bp.route("/<ride_id>", methods=["GET"])
@jwt_required()
def get_payment_status(ride_id):
    """Return payment status for a ride."""
    try:
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return jsonify({"error": "Ride not found"}), 404

        payment = Payment.objects(ride_id=ride).order_by("-created_at").first()

        return jsonify({
            "ride_id":        ride_id,
            "payment_status": ride.payment_status,
            "fare":           ride.fare,
            "payment":        payment.to_json_safe() if payment else None,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
