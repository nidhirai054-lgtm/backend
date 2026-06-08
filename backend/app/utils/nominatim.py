"""
Nominatim geocoder — resolves place names → (lat, lng).

Strategy:
  1. Check in-memory cache first
  2. Fast-path: match against BANGALORE_COORDS landmark table
  3. Live Nominatim API call (rate-limited to 1 req/s per policy)
  4. Fallback: Bangalore city centre (12.9716, 77.5946)

Usage:
    from app.utils.nominatim import geocode
    lat, lng = geocode("Koramangala 5th Block")
"""

import time
import threading
import requests

# ── Bangalore landmark fast-path lookup ──────────────────────────────────────
BANGALORE_COORDS: dict[str, tuple[float, float]] = {
    "koramangala":        (12.9352, 77.6245),
    "indiranagar":        (12.9716, 77.6412),
    "whitefield":         (12.9698, 77.7500),
    "electronic city":    (12.8456, 77.6603),
    "mg road":            (12.9716, 77.5946),
    "brigade road":       (12.9729, 77.6063),
    "airport":            (13.1986, 77.7066),
    "kempegowda airport": (13.1986, 77.7066),
    "hsr layout":         (12.9116, 77.6389),
    "jp nagar":           (12.9063, 77.5857),
    "jayanagar":          (12.9308, 77.5838),
    "marathahalli":       (12.9591, 77.6971),
    "hebbal":             (13.0353, 77.5970),
    "yeshwanthpur":       (13.0189, 77.5480),
    "rajajinagar":        (12.9902, 77.5558),
    "malleshwaram":       (13.0035, 77.5710),
    "yelahanka":          (13.1005, 77.5963),
    "bannerghatta":       (12.8001, 77.5773),
    "btm layout":         (12.9165, 77.6101),
    "silk board":         (12.9176, 77.6233),
    "bommanahalli":       (12.8921, 77.6437),
    "bellandur":          (12.9271, 77.6745),
    "sarjapur":           (12.8562, 77.7835),
    "old airport road":   (12.9669, 77.6458),
    "richmond road":      (12.9609, 77.5970),
    "ulsoor":             (12.9840, 77.6171),
    "cunningham road":    (12.9915, 77.5977),
    "sadashivanagar":     (13.0067, 77.5761),
    "basavanagudi":       (12.9419, 77.5740),
    "vijayanagar":        (12.9688, 77.5213),
    "mysore road":        (12.9490, 77.5250),
    "tumkur road":        (13.0310, 77.5380),
    "banashankari":       (12.9258, 77.5468),
    "ejipura":            (12.9479, 77.6268),
    "varthur":            (12.9347, 77.7356),
    "kr puram":           (13.0000, 77.6940),
    "nagavara":           (13.0503, 77.6259),
    "hennur":             (13.0327, 77.6340),
    "cv raman nagar":     (12.9858, 77.6578),
    "domlur":             (12.9612, 77.6390),
    "koramangala 1st":    (12.9285, 77.6171),
    "koramangala 6th":    (12.9312, 77.6271),
    "koramangala 7th":    (12.9256, 77.6314),
}

# ── In-memory cache ───────────────────────────────────────────────────────────
_cache: dict[str, tuple[float, float]] = {}
_cache_lock = threading.Lock()

# Nominatim rate limit: max 1 request/second
_last_request_time: float = 0.0
_rate_lock = threading.Lock()

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_HEADERS = {
    "User-Agent": "SmartRide/1.0 (smartride-project@noreply.com)"
}
BANGALORE_FALLBACK = (12.9716, 77.5946)


def _fast_lookup(name_lower: str) -> tuple[float, float] | None:
    """Check landmark table for exact or substring match."""
    for landmark, coords in BANGALORE_COORDS.items():
        if landmark in name_lower or name_lower in landmark:
            return coords
    return None


def _nominatim_lookup(name: str) -> tuple[float, float] | None:
    """
    Call Nominatim API. Enforces 1 req/s rate limit with a thread lock.
    Returns (lat, lng) or None on failure.
    """
    global _last_request_time

    with _rate_lock:
        elapsed = time.time() - _last_request_time
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        _last_request_time = time.time()

    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={
                "q": f"{name}, Bangalore, Karnataka, India",
                "format": "json",
                "limit": 1,
                "countrycodes": "in",
                "addressdetails": 0,
            },
            headers=NOMINATIM_HEADERS,
            timeout=5,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as exc:
        print(f"[Nominatim] Request failed for '{name}': {exc}")

    return None


def geocode(name: str) -> tuple[float, float]:
    """
    Resolve a place name to (lat, lng).

    Priority:
      1. In-memory cache
      2. Landmark table (fast, no network)
      3. Nominatim live API
      4. Bangalore city centre fallback
    """
    if not name or not name.strip():
        return BANGALORE_FALLBACK

    name_clean = name.strip()
    name_lower = name_clean.lower()

    # 1. Cache
    with _cache_lock:
        if name_lower in _cache:
            return _cache[name_lower]

    # 2. Landmark fast-path
    coords = _fast_lookup(name_lower)

    # 3. Nominatim
    if coords is None:
        coords = _nominatim_lookup(name_clean)

    # 4. Fallback
    if coords is None:
        print(f"[Nominatim] No result for '{name}', using Bangalore centre")
        coords = BANGALORE_FALLBACK

    # Cache result
    with _cache_lock:
        _cache[name_lower] = coords

    return coords
