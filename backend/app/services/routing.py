"""
Routing service — uses OSRM public API for real road-network distances,
durations, and simplified polylines.

Falls back to haversine calculation if OSRM is unavailable.

ETA throttle cache: get_eta_minutes() re-calls OSRM at most every 30 s
per (origin, dest) pair to avoid hammering the API on every GPS ping.
"""

import time
import requests
from app.utils.geo import haversine_km

OSRM_BASE = "http://router.project-osrm.org/route/v1/driving"
OSRM_HEADERS = {"User-Agent": "SmartRide/1.0 (smartride-project@noreply.com)"}
OSRM_TIMEOUT = 5  # seconds

# ── ETA throttle cache: { cache_key: (eta_minutes, timestamp) } ──────────────
_eta_cache: dict[str, tuple[int, float]] = {}
ETA_CACHE_TTL = 30  # seconds


# ── OSRM route fetch ──────────────────────────────────────────────────────────

def _fetch_osrm_route(
    pickup_lat: float, pickup_lng: float,
    dropoff_lat: float, dropoff_lng: float,
) -> dict | None:
    """
    Call OSRM /route/v1/driving endpoint.
    Returns dict with distance_meters, duration_seconds, polyline (WKT encoded coords)
    or None on any error.
    """
    coords = f"{pickup_lng},{pickup_lat};{dropoff_lng},{dropoff_lat}"
    url = f"{OSRM_BASE}/{coords}"
    try:
        resp = requests.get(
            url,
            params={"overview": "simplified", "geometries": "geojson"},
            headers=OSRM_HEADERS,
            timeout=OSRM_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != "Ok" or not data.get("routes"):
            return None

        route = data["routes"][0]
        legs = route.get("legs", [{}])[0]

        # Convert GeoJSON coordinates list → simple "lat,lng|lat,lng" string
        geo_coords = route.get("geometry", {}).get("coordinates", [])
        polyline_str = "|".join(f"{c[1]},{c[0]}" for c in geo_coords) if geo_coords else None

        return {
            "distance_meters": int(route["distance"]),
            "duration_seconds": int(route["duration"]),
            "polyline": polyline_str,
            "summary": legs.get("summary", ""),
        }
    except Exception as exc:
        print(f"[OSRM] Request failed: {exc}")
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def calculate_route(
    pickup_lat: float, pickup_lng: float,
    dropoff_lat: float, dropoff_lng: float,
) -> dict:
    """
    Calculate route between two points.
    Tries OSRM first, falls back to haversine.
    Returns a dict compatible with the existing booking / estimate endpoints.
    """
    osrm = _fetch_osrm_route(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)

    if osrm:
        distance_meters = osrm["distance_meters"]
        duration_seconds = osrm["duration_seconds"]
        polyline = osrm["polyline"]
        source = "osrm"
    else:
        # Haversine fallback — assume 25 km/h avg in Bangalore traffic
        distance_km = haversine_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        distance_meters = int(distance_km * 1000)
        duration_seconds = int((distance_km / 25) * 3600)
        polyline = None
        source = "haversine"

    distance_km = distance_meters / 1000

    return {
        "distance_meters": distance_meters,
        "distance_text": f"{distance_km:.1f} km",
        "duration_seconds": duration_seconds,
        "duration_text": f"{duration_seconds // 60} mins",
        "duration_in_traffic": duration_seconds,  # best estimate we have
        "polyline": polyline,
        "start_address": f"{pickup_lat},{pickup_lng}",
        "end_address": f"{dropoff_lat},{dropoff_lng}",
        "source": source,
    }


def get_eta_minutes(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    cache_key: str | None = None,
) -> int:
    """
    Get ETA in minutes from origin to dest.
    Results are cached for ETA_CACHE_TTL seconds to avoid hammering OSRM
    on every GPS ping during an active ride.

    Args:
        cache_key: Optional key (e.g. ride_id + "_arriving") to scope the cache.
                   If None, a coordinate-based key is used.
    """
    key = cache_key or f"{origin_lat:.4f},{origin_lng:.4f}->{dest_lat:.4f},{dest_lng:.4f}"

    cached = _eta_cache.get(key)
    if cached:
        eta_minutes, ts = cached
        if time.time() - ts < ETA_CACHE_TTL:
            return eta_minutes

    osrm = _fetch_osrm_route(origin_lat, origin_lng, dest_lat, dest_lng)
    if osrm:
        eta_minutes = max(1, int(osrm["duration_seconds"] / 60))
    else:
        # Haversine fallback at 25 km/h
        dist_km = haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
        eta_minutes = max(1, int((dist_km / 25) * 60))

    _eta_cache[key] = (eta_minutes, time.time())
    return eta_minutes


def calculate_fare(
    distance_meters: int,
    duration_seconds: int,
    ride_type: str,
    surge_multiplier: float = 1.0,
) -> dict:
    """
    Calculate fare based on distance, time, and ride type.
    Rates (₹):
      Solo:   ₹50 base + ₹12/km + ₹2/min
      Pooled: ₹50 base + ₹8/km  + ₹1.5/min
      EV:     ₹50 base + ₹10/km + ₹2/min
    """
    base_fare = 50.0
    distance_km = distance_meters / 1000
    duration_minutes = duration_seconds / 60

    rate_map = {
        "EV":     (10.0, 2.0),
        "pooled": (8.0,  1.5),
        "solo":   (12.0, 2.0),
    }
    per_km, per_min = rate_map.get(ride_type, (12.0, 2.0))

    distance_fare = distance_km * per_km
    time_fare = duration_minutes * per_min
    subtotal = base_fare + distance_fare + time_fare
    surge_fare = subtotal * (surge_multiplier - 1.0)
    total = round((subtotal + surge_fare) / 10) * 10  # round to ₹10

    return {
        "base_fare": base_fare,
        "distance_fare": round(distance_fare, 2),
        "time_fare": round(time_fare, 2),
        "surge_multiplier": surge_multiplier,
        "surge_fare": round(surge_fare, 2),
        "subtotal": round(subtotal, 2),
        "total": total,
    }


def calculate_surge_multiplier(lat: float, lng: float) -> float:
    """
    Time-of-day surge pricing.
    In production: integrate with real-time demand heatmap.
    """
    from datetime import datetime
    hour = datetime.now().hour
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        return 1.5   # morning + evening peak
    elif 22 <= hour or hour <= 5:
        return 1.3   # late night
    return 1.0
