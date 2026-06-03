from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.ml.chatbot.predict import predict_intent, get_response

chat_bp = Blueprint("chat", __name__)

# In-memory session context per user (keyed by user_id)
_session_context: dict = {}


@chat_bp.route("/message", methods=["POST"])
@jwt_required()
def chat_message():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        message = data.get("message", "").strip()

        if not message:
            return jsonify({"error": "Message cannot be empty"}), 400

        # Maintain multi-turn context
        context = _session_context.get(user_id, {})

        intent, confidence = predict_intent(message)
        response, action, context = get_response(intent, confidence, message, context)

        _session_context[user_id] = context

        return jsonify({
            "intent": intent,
            "confidence": round(confidence, 4),
            "response": response,
            "action": action,       # e.g. "trigger_booking", "trigger_cancel", None
            "context": context,
        }), 200
    except Exception as e:
        print(f"Chatbot error: {str(e)}")
        return jsonify({
            "error": "Chatbot service error",
            "message": str(e),
            "response": "I'm having trouble processing your request. Please try again.",
            "intent": "error",
            "confidence": 0.0,
            "action": None,
            "context": {}
        }), 500


@chat_bp.route("/session/reset", methods=["POST"])
@jwt_required()
def reset_session():
    user_id = get_jwt_identity()
    _session_context.pop(user_id, None)
    return jsonify({"message": "Session reset"}), 200


@chat_bp.route("/health", methods=["GET"])
def chatbot_health():
    """Check if chatbot is ready."""
    return jsonify({
        "status": "ready",
        "provider": "keyword-based",
    }), 200
