from app.utils.geo import haversine_km
from typing import List, Dict


def find_pool_matches(
    rides: List[Dict],
    new_pickup: Dict,
    new_dropoff: Dict,
    max_detour_km: float = 2.0,
) -> List[Dict]:
    """
    Find existing pooled rides whose route is within max_detour_km
    of the new passenger's pickup/dropoff using Haversine proximity.

    Args:
        rides: list of active pooled ride dicts with pickup/dropoff coords
        new_pickup: {lat, lng}
        new_dropoff: {lat, lng}
        max_detour_km: maximum allowed detour distance

    Returns:
        List of matching ride dicts sorted by proximity
    """
    matches = []
    for ride in rides:
        pickup_dist  = haversine_km(
            new_pickup["lat"], new_pickup["lng"],
            ride["pickup"]["lat"], ride["pickup"]["lng"]
        )
        dropoff_dist = haversine_km(
            new_dropoff["lat"], new_dropoff["lng"],
            ride["dropoff"]["lat"], ride["dropoff"]["lng"]
        )
        if pickup_dist <= max_detour_km and dropoff_dist <= max_detour_km:
            matches.append({**ride, "_detour": pickup_dist + dropoff_dist})

    return sorted(matches, key=lambda x: x["_detour"])
