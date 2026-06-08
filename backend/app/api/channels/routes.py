from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.channel import Channel
from app.models.message import Message
from app.models.space import Space
from bson import ObjectId

channels_bp = Blueprint("channels", __name__)


def _me():
    return User.objects(id=get_jwt_identity()).first()


def _assert_member(user, channel):
    space = Space.objects(id=channel.space_id.id).first()
    if not space:
        return jsonify({"error": "Space not found"}), 404
    if not user.community_id:
        return jsonify({"error": "No community"}), 403
    if str(space.community_id.id) != str(user.community_id.id):
        return jsonify({"error": "Access denied"}), 403
    return None


@channels_bp.route("/<channel_id>/messages", methods=["GET"])
@jwt_required()
def get_messages(channel_id):
    user = _me()
    ch = Channel.objects(id=channel_id).first()
    if not ch:
        return jsonify({"error": "Channel not found"}), 404
    err = _assert_member(user, ch)
    if err:
        return err

    limit = min(int(request.args.get("limit", 40)), 100)
    before = request.args.get("before")  # message id cursor

    query = {"channel_id": ch, "deleted": False}
    if before:
        try:
            query["id__lt"] = ObjectId(before)
        except Exception:
            pass

    messages = Message.objects(**query).order_by("-created_at").limit(limit)
    return jsonify([m.to_json_safe() for m in reversed(list(messages))]), 200


@channels_bp.route("/<channel_id>/messages", methods=["POST"])
@jwt_required()
def send_message(channel_id):
    user = _me()
    ch = Channel.objects(id=channel_id).first()
    if not ch:
        return jsonify({"error": "Channel not found"}), 404
    err = _assert_member(user, ch)
    if err:
        return err

    data = request.get_json() or {}
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "Message content required"}), 400

    msg = Message(channel_id=ch, sender_id=user, content=content, message_type="text")
    msg.save()

    from app.extensions import socketio
    socketio.emit("new_message", msg.to_json_safe(), room=f"channel_{channel_id}")

    return jsonify(msg.to_json_safe()), 201


@channels_bp.route("/<channel_id>/messages/<message_id>", methods=["DELETE"])
@jwt_required()
def delete_message(channel_id, message_id):
    user = _me()
    msg = Message.objects(id=message_id, channel_id=channel_id).first()
    if not msg:
        return jsonify({"error": "Message not found"}), 404
    if str(msg.sender_id.id) != str(user.id) and user.role != "admin":
        return jsonify({"error": "Not your message"}), 403

    msg.deleted = True
    msg.save()

    from app.extensions import socketio
    socketio.emit("message_deleted", {"message_id": message_id}, room=f"channel_{channel_id}")

    return jsonify({"message": "Deleted"}), 200
