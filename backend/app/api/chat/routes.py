from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.ml.chatbot.predict import call_minimax

chat_bp = Blueprint("chat", __name__)

# In-memory conversation history per user: {user_id: [{"role": "user"|"assistant", "content": str}]}
_histories: dict = {}
MAX_HISTORY = 6  # keep last 6 turns (3 exchanges) — enough context, avoids drift


def _get_history(user_id: str) -> list:
    return _histories.get(user_id, [])


def _push(user_id: str, role: str, content: str):
    h = _histories.setdefault(user_id, [])
    h.append({"role": role, "content": content})
    # Trim to last MAX_HISTORY turns
    if len(h) > MAX_HISTORY:
        _histories[user_id] = h[-MAX_HISTORY:]


def _execute_book_ride(user_id: str, entities: dict) -> dict | None:
    """
    If the model signals book_ride and entities are present, geocode and book.
    Returns the ride dict on success, None if anything is missing.
    """
    pickup_name  = entities.get("pickup")
    dropoff_name = entities.get("dropoff")
    # Normalise ride_type — model may return "pooled EV", "ev", etc.
    raw_type = (entities.get("ride_type") or "solo").lower()
    if "ev" in raw_type or "electric" in raw_type:
        ride_type = "EV"
    elif "pool" in raw_type or "shared" in raw_type:
        ride_type = "pooled"
    else:
        ride_type = "solo"
    women_only   = entities.get("women_only", False)

    if not pickup_name or not dropoff_name:
        return None

    try:
        from app.models.user import User
        from app.models.ride import Ride
        from app.utils.nominatim import geocode as nominatim_geocode
        from app.utils.carbon import calculate_co2_saved, calculate_green_points
        from app.services.routing import calculate_route, calculate_fare, calculate_surge_multiplier
        from app.ml.risk_score.calculator import compute_risk_score
        from app.api.rides.routes import _match_driver

        user = User.objects(id=user_id).first()
        if not user or user.role != "passenger":
            return None

        pickup_lat,  pickup_lng  = nominatim_geocode(pickup_name)
        dropoff_lat, dropoff_lng = nominatim_geocode(dropoff_name)

        pickup  = {"lat": pickup_lat,  "lng": pickup_lng,  "address": pickup_name}
        dropoff = {"lat": dropoff_lat, "lng": dropoff_lng, "address": dropoff_name}

        route          = calculate_route(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        surge          = calculate_surge_multiplier(pickup_lat, pickup_lng)
        fare_breakdown = calculate_fare(route["distance_meters"], route["duration_seconds"],
                                        ride_type, surge)
        distance_km    = route["distance_meters"] / 1000

        driver = _match_driver(ride_type, women_only, user, pickup_lat, pickup_lng)

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
            status="searching" if not driver else "driver_assigned",
            ride_type=ride_type,
            risk_score=risk_score,
            risk_label=risk_label,
            co2_saved=co2_saved,
            green_points_awarded=green_pts,
            fare=fare_breakdown["total"],
            distance_km=distance_km,
            estimated_duration_minutes=route["duration_seconds"] // 60,
            route_polyline=route.get("polyline"),
            surge_multiplier=surge,
            women_only=women_only,
            pool_passengers=1,
        )
        ride.save()

        if green_pts > 0:
            User.objects(id=user.id).update_one(inc__green_points=green_pts)

        return {"ride": ride.to_json_safe(), "driver": driver.to_json_safe() if driver else None}

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[chat book_ride] failed: {e}")
        return None


@chat_bp.route("/message", methods=["POST"])
@jwt_required()
def chat_message():
    try:
        user_id = get_jwt_identity()
        data    = request.get_json(silent=True) or {}
        message = (data.get("message") or "").strip()
        language = (data.get("language") or "en-IN").strip()

        if not message:
            return jsonify({"error": "Message cannot be empty"}), 400

        from app.models.user import User
        user = User.objects(id=user_id).first()
        user_role = user.role if user else "passenger"

        # Append user turn and call the model
        _push(user_id, "user", message)
        history = _get_history(user_id)

        # Bedrock requires: non-empty, starts with 'user', strictly alternating roles
        # Rebuild a clean alternating history from what we have
        clean = []
        for turn in history:
            if not clean:
                if turn["role"] == "user":
                    clean.append(turn)
            else:
                if turn["role"] != clean[-1]["role"]:
                    clean.append(turn)
                else:
                    # Same role twice — replace last with this one
                    clean[-1] = turn
        # Must end with user
        if not clean or clean[-1]["role"] != "user":
            clean = [{"role": "user", "content": message}]

        result = call_minimax(clean, user_role=user_role, language=language)

        response_text = result.get("response", "Sorry, something went wrong.")
        action        = result.get("action")
        entities      = result.get("entities") or {}

        # Append assistant turn to history
        _push(user_id, "assistant", response_text)

        booking_result = None
        if action == "book_ride":
            if user_role != "passenger":
                action = None
                response_text = "You're logged in as a driver — ride booking is for passengers only."
            else:
                booking_result = _execute_book_ride(user_id, entities)
                if not booking_result:
                    action = None
                    response_text += " (Booking failed — please use the booking form.)"

        return jsonify({
            "response":  response_text,
            "action":    action,
            "entities":  entities,
            "booking":   booking_result,
            "audio_url": None,  # Will be added by TTS endpoint
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "response": "I'm having trouble right now. Please try again.",
            "action":   None,
            "entities": {},
            "booking":  None,
            "audio_url": None,
        }), 500


@chat_bp.route("/tts", methods=["POST"])
@jwt_required()
def text_to_speech():
    """Convert text to speech using AWS Polly for all Indian languages"""
    try:
        import boto3
        from botocore.exceptions import ClientError
        import os
        import base64
        
        data = request.get_json(silent=True) or {}
        text = (data.get("text") or "").strip()
        language = (data.get("language") or "en-IN").strip()
        
        if not text:
            return jsonify({"error": "Text cannot be empty"}), 400
        
        # Map language codes to AWS Polly voice IDs and language codes
        POLLY_VOICES = {
            "en-IN": {"voice_id": "Aditi", "language_code": "en-IN", "engine": "neural"},
            "hi-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "bn-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "te-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "mr-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "ta-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "gu-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "kn-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "ml-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "pa-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "or-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
            "as-IN": {"voice_id": "Aditi", "language_code": "hi-IN", "engine": "standard"},
        }
        
        voice_config = POLLY_VOICES.get(language, POLLY_VOICES["en-IN"])
        
        polly = boto3.client(
            "polly",
            region_name=os.getenv("AWS_REGION", "us-east-1")
        )
        
        print(f"[TTS] Synthesizing: text={text[:50]}, voice={voice_config['voice_id']}, lang={voice_config['language_code']}")
        
        response = polly.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice_config["voice_id"],
            Engine=voice_config["engine"],
            LanguageCode=voice_config["language_code"],
            TextType="text",
        )
        
        # Return audio as base64
        audio_stream = response["AudioStream"].read()
        audio_base64 = base64.b64encode(audio_stream).decode("utf-8")
        
        print(f"[TTS] Generated audio size: {len(audio_stream)} bytes")
        
        return jsonify({
            "audio_base64": audio_base64,
            "content_type": "audio/mpeg",
        }), 200
        
    except ClientError as e:
        print(f"[TTS] AWS Polly error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "TTS service unavailable"}), 503
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "TTS failed"}), 500


@chat_bp.route("/session/reset", methods=["POST"])
@jwt_required()
def reset_session():
    user_id = get_jwt_identity()
    _histories.pop(user_id, None)
    return jsonify({"message": "Session reset"}), 200


@chat_bp.route("/health", methods=["GET"])
def chatbot_health():
    return jsonify({"status": "ready", "provider": "nova-lite-bedrock"}), 200
