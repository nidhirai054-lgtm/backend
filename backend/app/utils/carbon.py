# Karnataka grid emission factors (kg CO₂ per km)
EV_EMISSION_FACTOR     = 0.05   # kg CO₂/km
PETROL_EMISSION_FACTOR = 0.21   # kg CO₂/km

# Green Points config
GREEN_POINTS = {
    "EV":     10,
    "pooled":  5,
    "EV+pooled": 18,
    "solo":    0,
}
POINTS_TO_DISCOUNT = 100   # 100 pts = ₹10 fare discount
DISCOUNT_VALUE_INR  = 10.0


def calculate_co2_saved(distance_km: float, ride_type: str, pool_passengers: int = 1) -> float:
    """
    Calculate CO₂ saved compared to a solo petrol ride.
    For pooled rides, emissions are split across passengers.
    """
    petrol_emissions = distance_km * PETROL_EMISSION_FACTOR

    if ride_type == "EV":
        actual_emissions = distance_km * EV_EMISSION_FACTOR / max(pool_passengers, 1)
    elif ride_type == "pooled":
        actual_emissions = distance_km * PETROL_EMISSION_FACTOR / max(pool_passengers, 1)
    else:
        actual_emissions = petrol_emissions

    saved = petrol_emissions - actual_emissions
    return round(max(saved, 0.0), 4)


def calculate_green_points(ride_type: str, is_pooled: bool = False) -> int:
    """Return green points based on ride type and pooling status."""
    if ride_type == "EV" and is_pooled:
        return GREEN_POINTS["EV+pooled"]
    elif ride_type == "EV":
        return GREEN_POINTS["EV"]
    elif is_pooled or ride_type == "pooled":
        return GREEN_POINTS["pooled"]
    return GREEN_POINTS["solo"]


def points_to_discount(points: int) -> float:
    """Convert green points to INR discount value."""
    return (points // POINTS_TO_DISCOUNT) * DISCOUNT_VALUE_INR
