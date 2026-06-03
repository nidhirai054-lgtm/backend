import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two GPS coordinates."""
    R = 6371.0  # Earth's radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def heading_change(h1: float, h2: float) -> float:
    """Compute shortest angular difference between two headings (degrees)."""
    diff = abs(h1 - h2) % 360
    return diff if diff <= 180 else 360 - diff


def route_deviation_meters(
    current_lat: float, current_lng: float,
    expected_lat: float, expected_lng: float
) -> float:
    """Return deviation from expected route point in meters."""
    return haversine_km(current_lat, current_lng, expected_lat, expected_lng) * 1000
