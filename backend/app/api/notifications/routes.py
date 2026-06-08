"""
Push notification subscription endpoints.

POST /api/notifications/subscribe
    Saves (or upserts) a Web Push subscription for the calling user.
    Body: { endpoint, keys: { p256dh, auth } }

DELETE /api/notifications/unsubscribe
    Removes a subscription by endpoint.
    Body: { endpoint }

POST /api/notifications/test
    Sends a test push notification to the calling user.
    Useful during setup to confirm the pipeline works end-to-end.

GET /api/notifications/vapid-public-key
    Returns the VAPID public key needed by the frontend PushManager.
"""

import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.push_subscription import PushSubscription
from app.utils.push import send_push, VAPID_PUBLIC_KEY

notifications_bp = Blueprint("notifications", __name__)


def _get_current_user():
    return User.objects(id=get_jwt_identity()).first()


@notifications_bp.route("/vapid-public-key", methods=["GET"])
def get_vapid_public_key():
    """Return the VAPID public key for the frontend PushManager.subscribe()."""
    if not VAPID_PUBLIC_KEY:
        return jsonify({
            "error": "VAPID keys not configured",
            "hint": "Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to backend/.env",
        }), 503
    return jsonify({"public_key": VAPID_PUBLIC_KEY}), 200


@notifications_bp.route("/subscribe", methods=["POST"])
@jwt_required()
def subscribe():
    """Save or update a push subscription for the current user."""
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data     = request.get_json() or {}
    endpoint = data.get("endpoint")
    keys     = data.get("keys", {})
    p256dh   = keys.get("p256dh")
    auth     = keys.get("auth")

    if not all([endpoint, p256dh, auth]):
        return jsonify({"error": "endpoint, keys.p256dh, and keys.auth are required"}), 400

    # Upsert: update if endpoint exists, create if not
    existing = PushSubscription.objects(endpoint=endpoint).first()
    if existing:
        existing.user_id = user
        existing.p256dh  = p256dh
        existing.auth    = auth
        existing.save()
        sub = existing
    else:
        sub = PushSubscription(
            user_id=user,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
        )
        sub.save()

    return jsonify({
        "message": "Subscription saved",
        "subscription": sub.to_json_safe(),
    }), 201


@notifications_bp.route("/unsubscribe", methods=["DELETE"])
@jwt_required()
def unsubscribe():
    """Remove a specific push subscription."""
    data     = request.get_json() or {}
    endpoint = data.get("endpoint")
    if not endpoint:
        return jsonify({"error": "endpoint is required"}), 400

    deleted = PushSubscription.objects(endpoint=endpoint).delete()
    return jsonify({"message": f"Removed {deleted} subscription(s)"}), 200


@notifications_bp.route("/test", methods=["POST"])
@jwt_required()
def test_push():
    """Send a test push notification to the calling user."""
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    count = PushSubscription.objects(user_id=user).count()
    if count == 0:
        return jsonify({"error": "No push subscriptions found for this user"}), 404

    send_push(
        user_id=str(user.id),
        title="SmartRide Test",
        body="🎉 Push notifications are working!",
        url="/",
    )

    return jsonify({"message": f"Test push sent to {count} device(s)"}), 200
