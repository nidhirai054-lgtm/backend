from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
from bson import ObjectId
from app.models.user import User
from app.models.channel import Channel
from app.models.voice_session import VoiceSession
from app.extensions import socketio

voice_sessions_bp = Blueprint("voice_sessions", __name__)


def _me():
    return User.objects(id=get_jwt_identity()).first()


def _utcnow():
    return datetime.now(timezone.utc)


@voice_sessions_bp.route("/start", methods=["POST"])
@jwt_required()
def start_session():
    user = _me()
    data = request.get_json(silent=True) or {}
    channel_id = data.get("channel_id")

    # Validate channel_id is a valid ObjectId before querying
    try:
        ObjectId(channel_id)
    except Exception:
        return jsonify({"error": "Invalid channel_id"}), 400

    ch = Channel.objects(id=channel_id).first()
    if not ch:
        return jsonify({"error": "Channel not found"}), 404

    # End any existing active session for this channel
    VoiceSession.objects(channel_id=ch, is_active=True).update(
        set__is_active=False, set__ended_at=_utcnow()
    )

    session = VoiceSession(
        channel_id=ch,
        participants=[{"user_id": str(user.id), "name": user.name, "joined_at": _utcnow().isoformat(), "muted": False}],
        is_active=True,
    )
    session.save()

    socketio.emit("voice_user_joined", {"user_id": str(user.id), "name": user.name, "session_id": str(session.id)},
                  room=f"channel_{channel_id}")

    return jsonify(session.to_json_safe()), 201


@voice_sessions_bp.route("/<session_id>/join", methods=["POST"])
@jwt_required()
def join_session(session_id):
    try:
        ObjectId(session_id)
    except Exception:
        return jsonify({"error": "Invalid session_id"}), 400

    user = _me()
    session = VoiceSession.objects(id=session_id, is_active=True).first()
    if not session:
        return jsonify({"error": "No active voice session"}), 404

    if any(p["user_id"] == str(user.id) for p in session.participants):
        return jsonify({"error": "Already in session"}), 409

    session.participants.append({
        "user_id": str(user.id), "name": user.name,
        "joined_at": _utcnow().isoformat(), "muted": False,
    })
    session.save()

    socketio.emit("voice_user_joined", {"user_id": str(user.id), "name": user.name},
                  room=f"channel_{str(session.channel_id.id)}")

    return jsonify(session.to_json_safe()), 200


@voice_sessions_bp.route("/<session_id>/leave", methods=["POST"])
@jwt_required()
def leave_session(session_id):
    try:
        ObjectId(session_id)
    except Exception:
        return jsonify({"error": "Invalid session_id"}), 400

    user = _me()
    session = VoiceSession.objects(id=session_id, is_active=True).first()
    if not session:
        return jsonify({"error": "Session not found"}), 404

    session.participants = [p for p in session.participants if p["user_id"] != str(user.id)]

    if not session.participants:
        session.is_active = False
        session.ended_at  = _utcnow()

    session.save()

    socketio.emit("voice_user_left", {"user_id": str(user.id)},
                  room=f"channel_{str(session.channel_id.id)}")

    return jsonify({"message": "Left session"}), 200


@voice_sessions_bp.route("/channel/<channel_id>", methods=["GET"])
@jwt_required()
def get_active_session(channel_id):
    try:
        ObjectId(channel_id)
    except Exception:
        return jsonify({"error": "Invalid channel_id"}), 400

    ch = Channel.objects(id=channel_id).first()
    if not ch:
        return jsonify({"error": "Channel not found"}), 404
    session = VoiceSession.objects(channel_id=ch, is_active=True).first()
    if not session:
        return jsonify({"session": None}), 200
    return jsonify(session.to_json_safe()), 200
