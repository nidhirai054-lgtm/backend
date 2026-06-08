"""
Group routing service.
Uses OSRM /trip endpoint to compute optimal multi-stop pickup order.
Falls back to nearest-neighbour greedy if OSRM is unavailable.
"""
import requests
from app.utils.geo import haversine_km
from app.services.routing import calculate_fare, OSRM_BASE, OSRM_HEADERS, OSRM_TIMEOUT


def plan_group_route(participants, destination, ride_type="pooled"):
    """
    Given a list of participant dicts (each with a 'pickup' {lat, lng, address})
    and a shared destination {lat, lng, address}, return a route_plan dict.

    route_plan = {
        stops: [{user_id, name, pickup, stop_order, eta_from_prev_stop}],
        total_distance_km: float,
        total_duration_minutes: int,
        polyline: str | None,
        per_passenger_fare: {user_id: float},
    }
    """
    confirmed = [p for p in participants if p.get("status") == "confirmed"]
    if not confirmed:
        raise ValueError("No confirmed participants to route")

    ordered = _osrm_trip(confirmed, destination) or _greedy_order(confirmed, destination)

    # Annotate stop_order and eta
    stops = []
    cumulative_seconds = 0
    prev_lat = ordered[0]["pickup"]["lat"]
    prev_lng = ordered[0]["pickup"]["lng"]

    for i, p in enumerate(ordered):
        lat = p["pickup"]["lat"]
        lng = p["pickup"]["lng"]
        dist_km = haversine_km(prev_lat, prev_lng, lat, lng)
        segment_seconds = int((dist_km / 25) * 3600)  # 25 km/h city average
        cumulative_seconds += segment_seconds
        stops.append({
            "user_id":             p["user_id"],
            "name":                p["name"],
            "pickup":              p["pickup"],
            "stop_order":          i + 1,
            "eta_from_prev_stop":  max(1, segment_seconds // 60),
        })
        prev_lat, prev_lng = lat, lng

    # Final leg to destination
    final_dist = haversine_km(prev_lat, prev_lng, destination["lat"], destination["lng"])
    total_dist_km = sum(
        haversine_km(
            (stops[i - 1]["pickup"]["lat"] if i > 0 else stops[0]["pickup"]["lat"]),
            (stops[i - 1]["pickup"]["lng"] if i > 0 else stops[0]["pickup"]["lng"]),
            stops[i]["pickup"]["lat"],
            stops[i]["pickup"]["lng"],
        )
        for i in range(len(stops))
    ) + final_dist

    total_duration_s = int((total_dist_km / 25) * 3600)
    fare_breakdown = calculate_fare(int(total_dist_km * 1000), total_duration_s, ride_type)
    total_fare = fare_breakdown["total"]

    n = len(confirmed)
    per_person = round(total_fare / n / 10) * 10
    per_passenger_fare = {p["user_id"]: per_person for p in confirmed}

    return {
        "stops":                stops,
        "total_distance_km":    round(total_dist_km, 2),
        "total_duration_minutes": max(1, total_duration_s // 60),
        "polyline":             None,  # OSRM trip polyline would go here if available
        "per_passenger_fare":   per_passenger_fare,
        "total_fare":           total_fare,
    }


def _osrm_trip(participants, destination):
    """Call OSRM /trip to get optimised order. Returns ordered participant list or None."""
    try:
        coords = ";".join(
            f"{p['pickup']['lng']},{p['pickup']['lat']}" for p in participants
        )
        coords += f";{destination['lng']},{destination['lat']}"

        url = f"http://router.project-osrm.org/trip/v1/driving/{coords}"
        resp = requests.get(
            url,
            params={"source": "first", "destination": "last", "roundtrip": "false"},
            headers=OSRM_HEADERS,
            timeout=OSRM_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != "Ok" or not data.get("waypoints"):
            return None

        waypoints = data["waypoints"]
        # waypoints[i].waypoint_index gives the optimised order
        indexed = sorted(
            [(wp["waypoint_index"], i) for i, wp in enumerate(waypoints[:-1])],
            key=lambda x: x[0],
        )
        return [participants[orig_idx] for _, orig_idx in indexed]
    except Exception as e:
        print(f"[OSRM trip] failed: {e}")
        return None


def _greedy_order(participants, destination):
    """Nearest-neighbour greedy: start nearest to destination, work outward."""
    dest_lat, dest_lng = destination["lat"], destination["lng"]
    remaining = list(participants)

    # Start from participant closest to destination
    remaining.sort(
        key=lambda p: haversine_km(p["pickup"]["lat"], p["pickup"]["lng"], dest_lat, dest_lng)
    )

    ordered = [remaining.pop(0)]
    while remaining:
        last = ordered[-1]
        remaining.sort(
            key=lambda p: haversine_km(
                last["pickup"]["lat"], last["pickup"]["lng"],
                p["pickup"]["lat"], p["pickup"]["lng"],
            )
        )
        ordered.append(remaining.pop(0))

    return ordered
