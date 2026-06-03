import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from app.models.user import User
from app.models.community import Community
from app.utils.email_domain import get_community_for_email

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        required = ["name", "email", "password", "role"]
        if not all(k in data for k in required):
            return jsonify({"error": "Missing required fields"}), 400

        if User.objects(email=data["email"]).first():
            return jsonify({"error": "Email already registered"}), 409

        hashed = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt()).decode()

        # Auto-assign community by email domain
        community = get_community_for_email(data["email"])

        user = User(
            name=data["name"],
            email=data["email"],
            password_hash=hashed,
            role=data.get("role", "passenger"),
            gender=data.get("gender", "other"),
            vehicle_type=data.get("vehicle_type"),
            community_id=community,
        )
        user.save()

        # Add to community member list
        if community and community.id:
            Community.objects(id=community.id).update_one(push__member_ids=user)

        access_token  = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        return jsonify({
            "message": "User registered successfully",
            "user": user.to_json_safe(),
            "access_token": access_token,
            "refresh_token": refresh_token,
            "community": community.to_json_safe() if community else None,
        }), 201
    except Exception as e:
        return jsonify({"error": f"Database connection failed: {str(e)}"}), 503


@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        if not data.get("email") or not data.get("password"):
            return jsonify({"error": "Email and password required"}), 400

        user = User.objects(email=data["email"]).first()
        if not user or not bcrypt.checkpw(data["password"].encode(), user.password_hash.encode()):
            return jsonify({"error": "Invalid credentials"}), 401

        if not user.is_active:
            return jsonify({"error": "Account is deactivated"}), 403

        access_token  = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        return jsonify({
            "message": "Login successful",
            "user": user.to_json_safe(),
            "access_token": access_token,
            "refresh_token": refresh_token,
        }), 200
    except Exception as e:
        return jsonify({"error": f"Database connection failed: {str(e)}"}), 503


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify({"access_token": access_token}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_json_safe()), 200


@auth_bp.route("/verify", methods=["GET"])
@jwt_required()
def verify_token():
    """Verify if the current token is valid."""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()
    if not user or not user.is_active:
        return jsonify({"error": "Invalid or inactive user"}), 401
    return jsonify({"valid": True, "user": user.to_json_safe()}), 200
