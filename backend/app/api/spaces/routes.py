from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.space import Space
from app.models.channel import Channel

spaces_bp = Blueprint("spaces", __name__)


def _me():
    return User.objects(id=get_jwt_identity()).first()


def _assert_member(user, space):
    """Return 403 if user's community doesn't own this space."""
    if not user.community_id:
        return jsonify({"error": "You are not part of any community"}), 403
    if str(space.community_id.id) != str(user.community_id.id):
        return jsonify({"error": "Access denied"}), 403
    return None


@spaces_bp.route("/my", methods=["GET"])
@jwt_required()
def my_space():
    user = _me()
    if not user or not user.community_id:
        return jsonify({"error": "No community assigned"}), 404

    space = Space.objects(community_id=user.community_id.id).first()
    if not space:
        # Lazy-create if somehow missing
        community = user.community_id
        space = community.ensure_space()

    channels = Channel.objects(space_id=space).order_by("created_at")
    data = space.to_json_safe()
    data["channels"] = [c.to_json_safe() for c in channels]
    return jsonify(data), 200


@spaces_bp.route("/<space_id>/channels", methods=["GET"])
@jwt_required()
def list_channels(space_id):
    user = _me()
    space = Space.objects(id=space_id).first()
    if not space:
        return jsonify({"error": "Space not found"}), 404
    err = _assert_member(user, space)
    if err:
        return err
    channels = Channel.objects(space_id=space).order_by("created_at")
    return jsonify([c.to_json_safe() for c in channels]), 200


@spaces_bp.route("/<space_id>/channels", methods=["POST"])
@jwt_required()
def create_channel(space_id):
    user = _me()
    space = Space.objects(id=space_id).first()
    if not space:
        return jsonify({"error": "Space not found"}), 404
    err = _assert_member(user, space)
    if err:
        return err

    data = request.get_json() or {}
    name = data.get("name", "").strip().lower().replace(" ", "-")
    if not name:
        return jsonify({"error": "Channel name required"}), 400

    channel_type = data.get("channel_type", "text")
    if channel_type not in ("text", "voice"):
        channel_type = "text"

    if Channel.objects(space_id=space, name=name).first():
        return jsonify({"error": "Channel name already exists"}), 409

    ch = Channel(
        space_id=space,
        name=name,
        description=data.get("description", ""),
        channel_type=channel_type,
        is_default=False,
        created_by=user,
    )
    ch.save()
    space.channels.append(ch)
    space.save()

    from app.extensions import socketio
    socketio.emit("channel_created", ch.to_json_safe(), room=f"space_{space_id}")

    return jsonify(ch.to_json_safe()), 201


@spaces_bp.route("/<space_id>/channels/<channel_id>", methods=["DELETE"])
@jwt_required()
def delete_channel(space_id, channel_id):
    user = _me()
    space = Space.objects(id=space_id).first()
    if not space:
        return jsonify({"error": "Space not found"}), 404
    err = _assert_member(user, space)
    if err:
        return err

    ch = Channel.objects(id=channel_id, space_id=space).first()
    if not ch:
        return jsonify({"error": "Channel not found"}), 404
    if ch.is_default:
        return jsonify({"error": "Cannot delete a default channel"}), 400
    if str(ch.created_by.id) != str(user.id) and user.role != "admin":
        return jsonify({"error": "Only the creator or admin can delete this channel"}), 403

    ch.delete()

    from app.extensions import socketio
    socketio.emit("channel_deleted", {"channel_id": channel_id}, room=f"space_{space_id}")

    return jsonify({"message": "Channel deleted"}), 200
