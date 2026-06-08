"""
spaCy-based NER for extracting booking entities from voice transcripts.
Entities: PICKUP_LOC, DROPOFF_LOC, RIDE_TYPE
"""

import re
import spacy
from threading import Lock

_nlp = None
_nlp_lock = Lock()

# Ride type keywords
EV_KEYWORDS     = ["electric", "ev", "green", "eco", "zero emission"]
POOL_KEYWORDS   = ["pool", "shared", "share", "carpool", "split"]

# Preposition patterns for pickup/dropoff
FROM_PATTERN = re.compile(
    r'(?:from|pickup from|pick(?:\s+me)?\s+up\s+(?:at|from)?)\s+([A-Za-z0-9\s,]+?)(?:\s+to|\s+drop|\s+go|$)',
    re.IGNORECASE
)
TO_PATTERN = re.compile(
    r'(?:to|drop(?:\s+me)?\s+(?:at|to|off)?|going\s+to|take\s+me\s+to)\s+([A-Za-z0-9\s,]+?)(?:\s+from|\s+pick|$)',
    re.IGNORECASE
)


def _load_nlp():
    global _nlp
    with _nlp_lock:
        if _nlp is None:
            try:
                _nlp = spacy.load("en_core_web_sm")
            except OSError:
                # Model not downloaded — use blank pipeline
                _nlp = spacy.blank("en")


def extract_booking_entities(transcript: str) -> dict:
    """
    Extract pickup, dropoff, and ride_type from a voice transcript.

    Returns:
        {
            "pickup": str or None,
            "dropoff": str or None,
            "ride_type": "EV" | "pooled" | "solo",
        }
    """
    _load_nlp()
    text = transcript.lower()

    # Ride type detection
    ride_type = "solo"
    if any(kw in text for kw in EV_KEYWORDS):
        ride_type = "EV"
    elif any(kw in text for kw in POOL_KEYWORDS):
        ride_type = "pooled"

    # Location extraction via regex
    pickup  = None
    dropoff = None

    from_match = FROM_PATTERN.search(transcript)
    to_match   = TO_PATTERN.search(transcript)

    if from_match:
        pickup = from_match.group(1).strip().title()
    if to_match:
        dropoff = to_match.group(1).strip().title()

    # Fallback: use spaCy GPE/LOC entities if regex missed
    if not pickup or not dropoff:
        doc = _nlp(transcript)
        locs = [ent.text.title() for ent in doc.ents if ent.label_ in ("GPE", "LOC", "FAC")]
        if locs and not pickup:
            pickup = locs[0]
        if len(locs) > 1 and not dropoff:
            dropoff = locs[1]

    return {
        "pickup": pickup,
        "dropoff": dropoff,
        "ride_type": ride_type,
    }
