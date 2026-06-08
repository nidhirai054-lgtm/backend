"""
Chatbot backend using Amazon Nova Lite via Bedrock.
Returns structured JSON: {response, action, entities}
"""

import json
import os
import boto3
from botocore.exceptions import ClientError

from dotenv import load_dotenv
load_dotenv(override=True)

MODEL_ID = "amazon.nova-lite-v1:0"

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "bedrock-runtime",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
    return _client


SYSTEM_PROMPT = (
    "You are a helpful assistant for SmartRide, a ride-sharing app in Bangalore, India. "
    "Users can be passengers OR drivers. Do not assume the user has booked a ride. "
    "Output ONLY a raw JSON object, no markdown, no explanation. "
    'Schema: {"response":"str","action":"str_or_null","entities":{}}. '
    "action options: book_ride (passenger gives both pickup+dropoff), trigger_booking (incomplete locations), "
    "show_status, show_green, null. "
    'For book_ride set entities={"pickup":"loc","dropoff":"loc","ride_type":"solo|pooled|EV","women_only":false}. '
    "Rules: only set book_ride if user explicitly wants to book AND gives both locations. "
    "If user is a driver or asks driver-related questions, respond helpfully with action null. "
    "Default ride_type solo unless user says pool/shared/EV/electric. "
    "Respond in the same language the user uses (English, Hindi, or Hinglish). "
    "Keep response text short, friendly, and accurate to what the user actually asked. "
    "Green Points: EV=10pts, pooled=5pts, solo=2pts. "
    "CRITICAL: Write the 'response' field in the language specified below."
)


# Language prompt additions for multilingual support
LANGUAGE_PROMPTS = {
    "en-IN": "LANGUAGE: English. Write 'response' in English.",
    "hi-IN": "LANGUAGE: Hindi. Write 'response' ONLY in Hindi Devanagari script. Example: 'नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?'",
    "bn-IN": "LANGUAGE: Bengali. Write 'response' ONLY in Bengali Bangla script. Example: 'নমস্কার! আমি কিভাবে সাহায্য করতে পারি?'",
    "te-IN": "LANGUAGE: Telugu. Write 'response' ONLY in Telugu script. Example: 'నమస్కారం! నేను ఎలా సహాయం చేయగలను?'",
    "mr-IN": "LANGUAGE: Marathi. Write 'response' ONLY in Marathi Devanagari script. Example: 'नमस्कार! मी तुम्हाला कशी मदत करू शकतो?'",
    "ta-IN": "LANGUAGE: Tamil. Write 'response' ONLY in Tamil script. Example: 'வணக்கம்! நான் எப்படி உதவ முடியும்?'",
    "gu-IN": "LANGUAGE: Gujarati. Write 'response' ONLY in Gujarati script. Example: 'નમસ્તે! હું કેવી રીતે મદદ કરી શકું?'",
    "kn-IN": "LANGUAGE: Kannada. Write 'response' ONLY in Kannada script. Example: 'ನಮಸ್ಕಾರ! ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?'",
    "ml-IN": "LANGUAGE: Malayalam. Write 'response' ONLY in Malayalam script. Example: 'നമസ്കാരം! ഞാൻ എങ്ങനെ സഹായിക്കാം?'",
    "pa-IN": "LANGUAGE: Punjabi. Write 'response' ONLY in Punjabi Gurmukhi script. Example: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?'",
    "or-IN": "LANGUAGE: Odia. Write 'response' ONLY in Odia script. Example: 'ନମସ୍କାର! ମୁଁ କିପରି ସାହାୟ୍ୟ କରିପାରିବି?'",
    "as-IN": "LANGUAGE: Assamese. Write 'response' ONLY in Assamese script. Example: 'নমস্কাৰ! মই কেনেকৈ সহায় কৰিব পাৰোঁ?'",
}


def call_minimax(conversation_history: list, user_role: str = "passenger", language: str = "en-IN") -> dict:
    client = _get_client()

    role_context = (
        "The user is a DRIVER. They cannot book rides. Help with driver-related questions only. Never set action to book_ride."
        if user_role == "driver"
        else "The user is a PASSENGER who can book rides."
    )

    language_instruction = LANGUAGE_PROMPTS.get(language, LANGUAGE_PROMPTS["en-IN"])

    system = f"{SYSTEM_PROMPT} {role_context} {language_instruction}"
    messages = [
        {"role": t["role"], "content": [{"text": t["content"]}]}
        for t in conversation_history
    ]

    body = {
        "system": [{"text": system}],
        "messages": messages,
        "inferenceConfig": {"maxTokens": 512, "temperature": 0.3},
    }

    try:
        response = client.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
        raw = json.loads(response["body"].read())
        content = raw["output"]["message"]["content"][0]["text"].strip()

        # Strip markdown fences if model wraps output
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        return json.loads(content)

    except (ClientError, KeyError, json.JSONDecodeError, Exception) as e:
        import traceback
        traceback.print_exc()
        print(f"[Bedrock] Error type: {type(e).__name__}, message: {e}")
        # Reset cached client on connection errors so next call retries fresh
        if isinstance(e, ClientError):
            global _client
            _client = None
        return {
            "response": "Sorry, I'm having trouble reaching the AI service right now. You can still book a ride using the form above!",
            "action": None,
            "entities": {},
        }
