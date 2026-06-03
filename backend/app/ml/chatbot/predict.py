import os
import json
import random

BASE_DIR = os.path.dirname(__file__)
INTENTS_PATH = os.path.join(BASE_DIR, "intents.json")

_intents = None


def _load():
    """Load intents"""
    global _intents
    if _intents is not None:
        return
    
    with open(INTENTS_PATH, "r") as f:
        _intents = json.load(f)


def predict_intent(text: str):
    """
    Keyword-based intent detection.
    Returns (intent_tag, confidence_score).
    """
    _load()
    text_lower = text.lower()
    
    if any(word in text_lower for word in ['book', 'ride', 'cab', 'taxi', 'need', 'want', 'go to', 'take me']):
        return "booking", 0.9
    elif any(word in text_lower for word in ['cancel', 'stop', 'abort']):
        return "cancellation", 0.9
    elif any(word in text_lower for word in ['pool', 'share', 'shared']):
        return "pooling", 0.9
    elif any(word in text_lower for word in ['ev', 'electric', 'green', 'eco']):
        return "green_options", 0.9
    elif any(word in text_lower for word in ['women', 'female', 'lady', 'safe']):
        return "women_only", 0.9
    elif any(word in text_lower for word in ['fare', 'cost', 'price', 'charge']):
        return "fare_estimate", 0.9
    elif any(word in text_lower for word in ['status', 'where', 'track', 'eta']):
        return "ride_status", 0.9
    elif any(word in text_lower for word in ['bye', 'goodbye', 'see you', 'later']):
        return "goodbye", 0.9
    elif any(word in text_lower for word in ['hi', 'hello', 'hey', 'morning', 'evening']):
        return "greeting", 0.9
    else:
        return "greeting", 0.5


def get_response(intent: str, confidence: float, message: str, context: dict):
    """
    Generate response based on intent and context.
    Returns (response_text, action, updated_context).
    """
    _load()
    
    if not _intents:
        return "I'm still learning! Please try again later.", None, context
    
    # Get intent data
    intent_data = None
    for intent_obj in _intents["intents"]:
        if intent_obj["tag"] == intent:
            intent_data = intent_obj
            break
    
    if not intent_data:
        intent_data = _intents["intents"][0]  # Default to greeting
    
    # Determine action based on intent
    action = None
    if intent == "booking":
        context["pending_action"] = "booking"
        action = "trigger_booking"
    elif intent == "cancellation":
        action = "trigger_cancel"
        context.pop("pending_action", None)
    elif intent == "pooling":
        context["pending_action"] = "pooling"
        action = "trigger_pool"
    elif intent == "green_options":
        context["ride_type"] = "EV"
    elif intent == "women_only":
        context["women_only"] = True
    elif intent == "goodbye":
        context.clear()
    
    # Get random response from predefined responses
    response_text = random.choice(intent_data["responses"])
    
    # Add context-specific info
    if intent == "women_only":
        response_text += " Women-only filter is now active."
    
    return response_text, action, context
