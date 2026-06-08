from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import json
import boto3
import os
from threading import Lock
from app.utils.nominatim import geocode as nominatim_geocode

voice_bp = Blueprint("voice", __name__)

_bedrock = None
_bedrock_lock = Lock()

MAX_TRANSCRIPT_LEN = 500


def _get_bedrock():
    global _bedrock
    with _bedrock_lock:
        if _bedrock is None:
            _bedrock = boto3.client(
                "bedrock-runtime",
                region_name=os.getenv("AWS_REGION", "us-east-1"),
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            )
    return _bedrock


EXTRACT_SYSTEM = (
    "You are an entity extractor for a Bangalore ride-sharing app. "
    "Given a voice transcript (may be English, Hindi, or Hinglish), extract booking details. "
    "Output ONLY raw JSON, no markdown. "
    'Schema: {"pickup":"str_or_null","dropoff":"str_or_null","ride_type":"solo|pooled|EV","women_only":false,"understood":"short summary of what you understood"}. '
    "ride_type default is solo unless user says pool/shared/EV/electric/green. "
    "For location names use the common Bangalore area name only, e.g. 'Koramangala', 'Airport', 'Whitefield'. "
    "If a location is unclear or missing set it to null."
)


def extract_entities(transcript: str) -> dict:
    """Use Nova Lite to extract booking entities from a voice transcript."""
    try:
        client = _get_bedrock()
        body = json.dumps({
            "system": [{"text": EXTRACT_SYSTEM}],
            "messages": [{"role": "user", "content": [{"text": transcript[:MAX_TRANSCRIPT_LEN]}]}],
            "inferenceConfig": {"maxTokens": 256, "temperature": 0.1},
        })
        resp = client.invoke_model(
            modelId="amazon.nova-lite-v1:0",
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        raw = json.loads(resp["body"].read())
        content = raw["output"]["message"]["content"][0]["text"].strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        return json.loads(content)
    except Exception as e:
        print(f"[voice NER] Bedrock failed: {e}, falling back to spaCy")
        from app.ml.voice.ner import extract_booking_entities
        return extract_booking_entities(transcript)


@voice_bp.route("/process", methods=["POST"])
@jwt_required()
def process_voice():
    """
    Extract booking entities from a voice transcript.
    Does NOT book the ride — returns entities for the frontend confirmation step.
    Booking is done by the frontend calling /rides/book after user confirms.
    """
    data       = request.get_json(silent=True) or {}
    transcript = (data.get("transcript") or "").strip()

    if not transcript:
        return jsonify({"error": "Transcript is required"}), 400

    if len(transcript) > MAX_TRANSCRIPT_LEN:
        return jsonify({"error": f"Transcript too long (max {MAX_TRANSCRIPT_LEN} chars)"}), 400

    entities      = extract_entities(transcript)
    ready_to_book = bool(entities.get("pickup") and entities.get("dropoff"))

    return jsonify({
        "transcript":    transcript,
        "entities":      entities,
        "ready_to_book": ready_to_book,
        "understood":    entities.get("understood", transcript),
    }), 200


@voice_bp.route("/geocode", methods=["GET"])
@jwt_required()
def geocode_location():
    """Resolve a Bangalore location name to lat/lng."""
    name = request.args.get("name", "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    lat, lng = nominatim_geocode(name)
    return jsonify({"lat": lat, "lng": lng, "address": name}), 200
