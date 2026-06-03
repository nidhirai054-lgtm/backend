"""
Socket.io event handlers.
Passengers join their own room; admins join the 'admin' room.
"""

from flask_socketio import join_room, leave_room, emit
from flask_jwt_extended import decode_token
from app.extensions import socketio
from app.models.ride import Ride
from app.utils.geo import haversine_km
from datetime import datetime


@socketio.on("connect")
def on_connect(auth):
    """Client must pass JWT token in auth dict on connection."""
    token = (auth or {}).get("token")
    if not token:
        return False  # reject connection

    try:
        decoded = decode_token(token)
        user_id = decoded["sub"]
    except Exception:
        return False

    # Store user_id in session
    from flask import request
    request.environ["user_id"] = user_id
    emit("connected", {"message": "Connected to SmartRide real-time service"})


@socketio.on("join_passenger_room")
def join_passenger(data):
    """Passenger joins their private room to receive safety alerts."""
    user_id = data.get("user_id")
    if user_id:
        join_room(f"passenger_{user_id}")
        emit("room_joined", {"room": f"passenger_{user_id}"})


@socketio.on("join_admin_room")
def join_admin(data):
    """Admin joins the global admin room."""
    join_room("admin")
    emit("room_joined", {"room": "admin"})


@socketio.on("disconnect")
def on_disconnect():
    emit("disconnected", {"message": "Disconnected from SmartRide"})


@socketio.on("driver_location_update")
def driver_location_update(data):
    """
    Driver broadcasts location; admin dashboard receives it.
    data: {driver_id, lat, lng, speed_kmh}
    """
    socketio.emit("driver_moved", data, room="admin")


@socketio.on("update_driver_location")
def update_driver_location(data):
    """
    Driver sends real-time location during active ride.
    data: {ride_id, lat, lng, heading}
    """
    ride_id = data.get("ride_id")
    lat = data.get("lat")
    lng = data.get("lng")
    heading = data.get("heading", 0)
    
    if not ride_id or lat is None or lng is None:
        return
    
    try:
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return
        
        # Update driver location
        ride.driver_current_location = {
            "lat": lat,
            "lng": lng,
            "heading": heading,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Calculate real-time ETA based on current position
        if ride.status == "driver_arriving":
            # Distance to pickup
            distance_km = haversine_km(lat, lng, ride.pickup["lat"], ride.pickup["lng"])
        elif ride.status == "in_progress":
            # Distance to dropoff
            distance_km = haversine_km(lat, lng, ride.dropoff["lat"], ride.dropoff["lng"])
        else:
            distance_km = 0
        
        # Assume 30 km/h average speed
        eta_minutes = int((distance_km / 30) * 60)
        ride.actual_eta_minutes = max(1, eta_minutes)
        
        ride.save()
        
        # Emit to passenger
        passenger_id = str(ride.passenger_id.id)
        socketio.emit("ride_location_update", {
            "ride_id": str(ride.id),
            "driver_location": {
                "lat": lat,
                "lng": lng,
                "heading": heading
            },
            "eta_minutes": ride.actual_eta_minutes,
            "status": ride.status
        }, room=f"passenger_{passenger_id}")
        
    except Exception as e:
        print(f"Error updating driver location: {e}")


@socketio.on("update_ride_status")
def update_ride_status(data):
    """
    Driver updates ride status.
    data: {ride_id, status}
    """
    ride_id = data.get("ride_id")
    new_status = data.get("status")
    
    if not ride_id or not new_status:
        return
    
    try:
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return
        
        ride.status = new_status
        
        if new_status == "completed":
            ride.completed_at = datetime.utcnow()
        
        ride.save()
        
        # Notify passenger
        passenger_id = str(ride.passenger_id.id)
        socketio.emit("ride_status_changed", {
            "ride_id": str(ride.id),
            "status": new_status
        }, room=f"passenger_{passenger_id}")
        
    except Exception as e:
        print(f"Error updating ride status: {e}")
