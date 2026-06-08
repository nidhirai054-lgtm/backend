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
    """Higher risk at night (22:00–05:00 IST)."""
    from datetime import timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    hour = datetime.now(IST).hour
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

    # Bangalore high-risk zones (areas with elevated night-time incident density)
    high_risk_zones = [
        {
            "name": "Outer Ring Road Corridor",
            "lat_min": 12.90, "lat_max": 12.96,
            "lng_min": 77.70, "lng_max": 77.76,
            "risk": 0.7
        },
        {
            "name": "Hosur Road / Electronic City",
            "lat_min": 12.83, "lat_max": 12.92,
            "lng_min": 77.60, "lng_max": 77.70,
            "risk": 0.6
        },
        {
            "name": "Tumkur Road Industrial Belt",
            "lat_min": 13.00, "lat_max": 13.08,
            "lng_min": 77.50, "lng_max": 77.56,
            "risk": 0.5
        },
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
