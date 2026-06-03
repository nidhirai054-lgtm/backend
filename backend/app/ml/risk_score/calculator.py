"""
Pre-trip composite AI Risk Score for a driver.

risk_score = (anomaly_rate_30d × 0.40) +
             ((1 - avg_rating/5) × 0.30) +
             (time_of_day_risk × 0.15) +
             (route_zone_risk × 0.15)

Labels:
  Green  → 0.00 – 0.30
  Yellow → 0.30 – 0.60
  Red    → 0.60 – 1.00
"""

from datetime import datetime, timedelta
from typing import Tuple


def _anomaly_rate(driver_id: str) -> float:
    """Fraction of rides in past 30 days that triggered an anomaly alert."""
    from app.models.alert import Alert
    from app.models.ride import Ride

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    total_rides = Ride.objects(
        driver_id=driver_id,
        created_at__gte=thirty_days_ago,
        status__in=["completed", "active"]
    ).count()

    if total_rides == 0:
        return 0.0

    anomalous = Alert.objects(
        driver_id=driver_id,
        created_at__gte=thirty_days_ago,
    ).count()

    return min(anomalous / total_rides, 1.0)


def _time_of_day_risk() -> float:
    """Higher risk at night (22:00–05:00)."""
    hour = datetime.utcnow().hour
    if 22 <= hour or hour <= 5:
        return 0.8
    elif 6 <= hour <= 9 or 17 <= hour <= 21:
        return 0.4   # peak hours
    return 0.1


def _zone_risk(driver_id: str) -> float:
    """
    Check if driver is in a high-risk zone.
    Returns risk value 0.0 to 1.0.
    """
    from app.models.user import User
    driver = User.objects(id=driver_id).first()
    if not driver:
        return 0.0

    # Mock high-risk zones (e.g. specific Lat/Lng bounding boxes)
    # Zone 1: "Red Zone Alpha"
    high_risk_zones = [
        {"name": "Zone Alpha", "lat_min": 28.5, "lat_max": 28.6, "lng_min": 77.1, "lng_max": 77.2, "risk": 0.8},
        {"name": "Zone Beta",  "lat_min": 19.0, "lat_max": 19.1, "lng_min": 72.8, "lng_max": 72.9, "risk": 0.6},
    ]

    for zone in high_risk_zones:
        if (zone["lat_min"] <= driver.last_lat <= zone["lat_max"] and
            zone["lng_min"] <= driver.last_lng <= zone["lng_max"]):
            return zone["risk"]

    return 0.1  # Default low risk


def compute_risk_score(driver_id: str) -> Tuple[float, str]:
    """
    Compute composite risk score for a driver.
    Returns (score: float, label: str)
    """
    from app.models.user import User

    driver = User.objects(id=driver_id).first()
    if not driver:
        return 0.0, "green"

    anomaly_rate = _anomaly_rate(driver_id)
    rating_risk  = 1.0 - min(driver.avg_rating / 5.0, 1.0)
    tod_risk     = _time_of_day_risk()
    zone_risk    = _zone_risk(driver_id)

    score = (
        anomaly_rate * 0.40 +
        rating_risk  * 0.30 +
        tod_risk     * 0.15 +
        zone_risk    * 0.15
    )
    score = round(min(score, 1.0), 4)

    if score <= 0.30:
        label = "green"
    elif score <= 0.60:
        label = "yellow"
    else:
        label = "red"

    return score, label
