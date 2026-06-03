"""
Routing service using haversine calculation
"""
from app.utils.geo import haversine_km
from datetime import datetime

def calculate_route(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng):
    """
    Calculate route using haversine distance
    Returns route details including distance and duration
    """
    distance_km = haversine_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
    distance_meters = int(distance_km * 1000)
    # Assume 30 km/h average speed in Bangalore traffic
    duration_seconds = int((distance_km / 30) * 3600)
    
    return {
        'distance_meters': distance_meters,
        'distance_text': f"{distance_km:.1f} km",
        'duration_seconds': duration_seconds,
        'duration_text': f"{duration_seconds // 60} mins",
        'duration_in_traffic': None,
        'polyline': None,
        'start_address': f"{pickup_lat},{pickup_lng}",
        'end_address': f"{dropoff_lat},{dropoff_lng}"
    }

def calculate_fare(distance_meters, duration_seconds, ride_type, surge_multiplier=1.0):
    """
    Calculate fare based on distance, time, and ride type
    """
    # Base fare
    base_fare = 50.0  # ₹50
    
    # Per km rate
    distance_km = distance_meters / 1000
    if ride_type == 'EV':
        per_km_rate = 10.0
    elif ride_type == 'pooled':
        per_km_rate = 8.0
    else:
        per_km_rate = 12.0
    
    # Per minute rate
    duration_minutes = duration_seconds / 60
    per_minute_rate = 2.0
    
    # Calculate components
    distance_fare = distance_km * per_km_rate
    time_fare = duration_minutes * per_minute_rate
    
    # Total before surge
    subtotal = base_fare + distance_fare + time_fare
    
    # Apply surge
    surge_fare = subtotal * (surge_multiplier - 1.0)
    total = subtotal + surge_fare
    
    # Round to nearest 10
    total = round(total / 10) * 10
    
    return {
        'base_fare': base_fare,
        'distance_fare': round(distance_fare, 2),
        'time_fare': round(time_fare, 2),
        'surge_multiplier': surge_multiplier,
        'surge_fare': round(surge_fare, 2),
        'subtotal': round(subtotal, 2),
        'total': total
    }

def calculate_surge_multiplier(lat, lng):
    """
    Calculate surge pricing based on demand
    In production, this would check real-time demand data
    """
    from datetime import datetime
    
    hour = datetime.now().hour
    
    # Peak hours surge
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        return 1.5
    elif 22 <= hour or hour <= 5:
        return 1.3
    
    return 1.0
