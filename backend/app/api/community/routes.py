from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.models.community import Community

community_bp = Blueprint("community", __name__)


@community_bp.route("/", methods=["GET"])
@jwt_required()
def get_community():
    user = User.objects(id=get_jwt_identity()).first()
    if not user or not user.community_id:
        return jsonify({"community": None, "message": "Not part of any community"}), 200

    community = Community.objects(id=user.community_id.id).first()
    return jsonify(community.to_json_safe()), 200


@community_bp.route("/members", methods=["GET"])
@jwt_required()
def community_members():
    user = User.objects(id=get_jwt_identity()).first()
    if not user or not user.community_id:
        return jsonify({"error": "Not part of any community"}), 404

    community = Community.objects(id=user.community_id.id).first()
    members = User.objects(community_id=community).only(
        "name", "email", "role", "gender",
        "reputation_score", "avg_rating"
    )
    return jsonify([m.to_json_safe() for m in members]), 200


@community_bp.route("/reputation", methods=["GET"])
@jwt_required()
def community_reputation():
    user = User.objects(id=get_jwt_identity()).first()
    if not user or not user.community_id:
        return jsonify({"error": "Not part of any community"}), 404

    members = User.objects(community_id=user.community_id).order_by(
        "-reputation_score"
    ).only("name", "reputation_score", "avg_rating", "green_points")

    return jsonify([
        {
            "name": m.name,
            "reputation_score": m.reputation_score,
            "avg_rating": m.avg_rating,
            "green_points": m.green_points,
        }
        for m in members
    ]), 200


@community_bp.route("/all", methods=["GET"])
@jwt_required()
def list_communities():
    """Admin: list all communities."""
    user = User.objects(id=get_jwt_identity()).first()
    if not user or user.role != "admin":
        return jsonify({"error": "Admin access only"}), 403
    communities = Community.objects().all()
    return jsonify([c.to_json_safe() for c in communities]), 200
