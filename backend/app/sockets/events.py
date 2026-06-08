"""
Socket.io event handlers.
Passengers join their own room; admins join the 'admin' room.
Drivers can also emit to ride-specific rooms (ride_<ride_id>) for broader delivery.

GPS anomaly scoring is wired inline into update_driver_location.
An in-memory sliding window (_gps_buffers) holds the last GPS_WINDOW
pings per driver. On each update, score_window() is called synchronously.
If anomalous, an Alert is created and safety_alert is emitted to both
the passenger room and the admin room.

ETA is fetched from OSRM once every ETA_REFRESH_INTERVAL seconds per ride
to avoid hammering the routing API on every GPS ping.
"""

from flask_socketio import join_room, leave_room, emit
from flask_jwt_extended import decode_token
from app.extensions import socketio
from app.models.ride import Ride
from app.utils.geo import haversine_km
from app.services.routing import get_eta_minutes
from datetime import datetime
import time

# Throttle: recalculate ETA via OSRM at most every N seconds per ride
ETA_REFRESH_INTERVAL = 30  # seconds
_eta_last_refresh: dict = {}   # {ride_id: timestamp}


# ── In-memory GPS sliding window (replaces Redis for inline scoring) ──────────
_gps_buffers: dict = {}   # {driver_id_str: [ping_dict, ...]}
GPS_WINDOW = 10           # number of pings to keep per driver


# ── Connection lifecycle ───────────────────────────────────────────────────────

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


@socketio.on("join_drivers_room")
def join_drivers(data):
    """Driver joins the shared drivers room to receive new ride notifications."""
    join_room("drivers")
    emit("room_joined", {"room": "drivers"})


@socketio.on("join_ride_room")
def join_ride(data):
    """
    Any participant (passenger, driver, or admin) can join a ride-specific room.
    This enables targeted broadcast to everyone tracking a particular ride.
    data: {ride_id}
    """
    ride_id = data.get("ride_id")
    if ride_id:
        join_room(f"ride_{ride_id}")
        emit("room_joined", {"room": f"ride_{ride_id}"})


@socketio.on("disconnect")
def on_disconnect():
    emit("disconnected", {"message": "Disconnected from SmartRide"})


# ── Legacy event: broadcast driver position to admin only ─────────────────────

@socketio.on("driver_location_update")
def driver_location_update(data):
    """
    Driver broadcasts location; admin dashboard receives it.
    data: {driver_id, lat, lng, speed_kmh}
    """
    socketio.emit("driver_moved", data, room="admin")


# ── Primary event: real-time ride location + anomaly scoring ──────────────────

@socketio.on("update_driver_location")
def update_driver_location(data):
    """
    Driver sends real-time location during active ride.
    data: {ride_id, lat, lng, heading, speed_kmh (optional)}

    Steps:
      1. Update ride.driver_current_location in DB
      2. Calculate real-time ETA
      3. Emit ride_location_update to passenger
      4. [NEW] Score GPS window for anomalies — emit safety_alert if triggered
    """
    ride_id = data.get("ride_id")
    lat     = data.get("lat")
    lng     = data.get("lng")
    heading = data.get("heading", 0)
    speed   = data.get("speed_kmh", 30.0)  # default 30 km/h if not provided

    if not ride_id or lat is None or lng is None:
        return

    try:
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return

        # 1. Persist current location
        ride.driver_current_location = {
            "lat": lat,
            "lng": lng,
            "heading": heading,
            "timestamp": datetime.utcnow().isoformat()
        }

        # 2. Calculate real-time ETA (throttled OSRM call, haversine fallback)
        ride_id_str = str(ride.id)
        now = time.time()
        last_refresh = _eta_last_refresh.get(ride_id_str, 0)

        if now - last_refresh >= ETA_REFRESH_INTERVAL:
            # Determine destination based on ride status
            if ride.status == "driver_arriving":
                dest_lat, dest_lng = ride.pickup["lat"], ride.pickup["lng"]
            elif ride.status == "in_progress":
                dest_lat, dest_lng = ride.dropoff["lat"], ride.dropoff["lng"]
            else:
                dest_lat, dest_lng = ride.pickup["lat"], ride.pickup["lng"]

            eta_minutes = get_eta_minutes(
                lat, lng, dest_lat, dest_lng,
                cache_key=f"{ride_id_str}_{ride.status}"
            )
            _eta_last_refresh[ride_id_str] = now
        else:
            # Re-use cached value or estimate from stored field
            eta_minutes = ride.actual_eta_minutes or 5

        ride.actual_eta_minutes = eta_minutes
        ride.save()

        # Update driver User document coordinates in DB
        if ride.driver_id:
            from app.models.user import User
            User.objects(id=ride.driver_id.id).update_one(
                set__last_lat=lat,
                set__last_lng=lng
            )

        # 3. Emit to passenger room AND ride-specific room
        passenger_id = str(ride.passenger_id.id)
        location_payload = {
            "ride_id":         str(ride.id),
            "driver_location": {"lat": lat, "lng": lng, "heading": heading},
            "eta_minutes":     eta_minutes,
            "status":          ride.status
        }
        socketio.emit("ride_location_update", location_payload, room=f"passenger_{passenger_id}")
        socketio.emit("ride_location_update", location_payload, room=f"ride_{ride_id_str}")

        # Also broadcast to admin live map
        if ride.driver_id:
            socketio.emit("driver_moved", {
                "driver_id": str(ride.driver_id.id),
                "lat": lat, "lng": lng,
                "speed_kmh": speed
            }, room="admin")

        # 4. [FIX 3] GPS anomaly scoring ─────────────────────────────────────
        if ride.driver_id:
            driver_id_str = str(ride.driver_id.id)
            _score_gps_inline(driver_id_str, ride, lat, lng, heading, speed)

    except Exception as e:
        print(f"Error in update_driver_location: {e}")


def _score_gps_inline(driver_id: str, ride, lat: float, lng: float,
                      heading: float, speed: float):
    """
    Maintain a sliding window of GPS pings per driver and run the
    Isolation Forest anomaly model synchronously.
    Creates an Alert + emits safety_alert if anomalous.
    """
    from app.ml.anomaly.predict import score_window

    # Build ping dict matching the feature schema expected by score_window()
    ping = {
        "lat":              lat,
        "lng":              lng,
        "speed_kmh":        speed,
        "heading":          heading,
        "stop_duration_s":  0.0,  # not tracked at socket level
        "route_deviation_m": 0.0,  # simplification: deviation scored by speed/heading
        "ts":               datetime.utcnow().isoformat(),
    }

    # Update sliding window
    buf = _gps_buffers.setdefault(driver_id, [])
    buf.append(ping)
    if len(buf) > GPS_WINDOW:
        buf.pop(0)

    # Need at least 3 pings for meaningful scoring
    if len(buf) < 3:
        return

    try:
        score, is_anomalous, alert_type = score_window(buf)
    except Exception as e:
        print(f"Anomaly scoring error: {e}")
        return

    if is_anomalous and alert_type:
        _create_and_emit_alert(ride, driver_id, score, alert_type)


def _create_and_emit_alert(ride, driver_id: str, score: float, alert_type: str):
    """
    Save an Alert document and push safety_alert to the passenger room
    and admin room. Skips if an unresolved alert for this ride already exists.
    """
    from app.models.alert import Alert
    from app.models.user import User

    driver = User.objects(id=driver_id).first()
    if not driver:
        return

    # Deduplication: one active alert per ride at a time
    existing = Alert.objects(ride_id=ride, resolved=False).first()
    if existing:
        return

    try:
        alert = Alert(
            ride_id=ride,
            driver_id=driver,
            alert_type=alert_type,
            anomaly_score=abs(score),  # score is negative for anomalies
        )
        alert.save()
    except Exception as e:
        print(f"Failed to save alert: {e}")
        return

    payload = {
        "alert_id":    str(alert.id),
        "ride_id":     str(ride.id),
        "driver_id":   driver_id,
        "driver_name": driver.name,
        "alert_type":  alert_type,
        "score":       abs(score),
        "created_at":  alert.created_at.isoformat(),
    }

    # Emit to passenger (they see a banner in tracking modal)
    passenger_id = str(ride.passenger_id.id) if ride.passenger_id else None
    if passenger_id:
        socketio.emit("safety_alert", payload, room=f"passenger_{passenger_id}")

    # Emit to admin command center
    socketio.emit("safety_alert", payload, room="admin")
    print(f"🚨 Safety alert: {alert_type} (score={abs(score):.3f}) for ride {ride.id}")


# ── Ride status update by driver ──────────────────────────────────────────────

@socketio.on("update_ride_status")
def update_ride_status(data):
    """
    Driver updates ride status.
    data: {ride_id, status}
    Valid transitions:
      driver_assigned → driver_arriving
      driver_arriving → in_progress
      in_progress     → completed
    """
    ride_id    = data.get("ride_id")
    new_status = data.get("status")

    if not ride_id or not new_status:
        return

    valid_transitions = {
        "driver_assigned": ["driver_arriving", "cancelled"],
        "driver_arriving": ["in_progress", "cancelled"],
        "in_progress":     ["completed"],
    }

    try:
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return

        allowed = valid_transitions.get(ride.status, [])
        if new_status not in allowed:
            print(f"Invalid status transition: {ride.status} → {new_status}")
            return

        ride.status = new_status
        if new_status == "completed":
            ride.completed_at = datetime.utcnow()
            # Clear GPS buffer for this driver on completion
            if ride.driver_id:
                _gps_buffers.pop(str(ride.driver_id.id), None)

        ride.save()

        # Notify passenger
        passenger_id = str(ride.passenger_id.id)
        socketio.emit("ride_status_changed", {
            "ride_id": str(ride.id),
            "status":  new_status
        }, room=f"passenger_{passenger_id}")

        print(f"Ride {ride_id}: {ride.status} → {new_status}")

    except Exception as e:
        print(f"Error updating ride status: {e}")


# ── Passenger SOS ─────────────────────────────────────────────────────────────

@socketio.on("passenger_sos")
def handle_passenger_sos(data):
    """
    Passenger triggers SOS during an active ride.
    data: {ride_id, passenger_id, lat (optional), lng (optional)}
    Creates a high-priority 'sos' alert, notifies admin, and alerts emergency contacts.
    """
    ride_id      = data.get("ride_id")
    passenger_id = data.get("passenger_id")
    lat          = data.get("lat")
    lng          = data.get("lng")
    notify_contacts = data.get("notify_contacts", True)
    notify_police   = data.get("notify_police", True)

    if not ride_id:
        return

    try:
        from app.models.alert import Alert
        from app.models.user import User
        from app.api.safety.sms import build_whatsapp_sos_message, build_location_url, alert_police_control_room
        from app.tasks.celery_tasks import log_sos_event_task

        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return

        passenger = User.objects(id=passenger_id).first() if passenger_id else None
        driver = None
        if ride.driver_id:
            driver = User.objects(id=ride.driver_id.id).first()

        alert = Alert(
            ride_id=ride,
            driver_id=driver or ride.driver_id,
            alert_type="sos",
            anomaly_score=1.0,  # max severity
            notified_contacts=notify_contacts,
            notified_police=notify_police,
        )
        alert.save()

        # Build location link for SMS and UI
        location_url = build_location_url(lat, lng) if lat and lng else "Location unavailable"
        passenger_name = passenger.name if passenger else "A passenger"

        # Notify emergency contacts
        pickup_addr = ride.pickup.get("address", "Unknown Pickup")
        dropoff_addr = ride.dropoff.get("address", "Unknown Dropoff")
        d_name = driver.name if driver else "Unknown"
        d_vehicle = driver.vehicle_type if driver and driver.vehicle_type else "Unknown Vehicle"
        
        whatsapp_body = build_whatsapp_sos_message(
            passenger_name=passenger_name,
            location_url=location_url,
            ride_id=str(ride.id),
            pickup=pickup_addr,
            dropoff=dropoff_addr,
            driver_name=d_name,
            driver_vehicle=d_vehicle
        )

        contacts_notified = 0
        if notify_contacts and passenger and passenger.emergency_contacts:
            for contact in passenger.emergency_contacts:
                if contact.notify_sms and contact.phone:
                    log_sos_event_task.delay(contact.phone, whatsapp_body)
                    contacts_notified += 1

        # Notify police control room
        if notify_police:
            alert_police_control_room(str(ride.id), location_url)

        payload = {
            "alert_id":    str(alert.id),
            "ride_id":     ride_id,
            "driver_id":   str(ride.driver_id.id) if ride.driver_id else None,
            "driver_name": driver.name if driver else "Unknown",
            "alert_type":  "sos",
            "score":       1.0,
            "pickup":      ride.pickup,
            "dropoff":     ride.dropoff,
            "created_at":  alert.created_at.isoformat(),
            "lat":         lat,
            "lng":         lng,
        }

        # Broadcast SOS to admin immediately
        socketio.emit("sos_triggered", payload, room="admin")
        socketio.emit("safety_alert",  payload, room="admin")

        # Confirm to passenger with context
        if passenger_id:
            socketio.emit("sos_confirmed", {
                "message": "SOS sent. Help is on the way.",
                "alert_id": str(alert.id),
                "contacts_notified": contacts_notified,
                "notified_police": notify_police,
                "location_link": location_url,
                "whatsapp_message": whatsapp_body if notify_contacts else None,
                "emergency_contacts": [c.to_dict() for c in (passenger.emergency_contacts or [])] if passenger else []
            }, room=f"passenger_{passenger_id}")

        print(f"🆘 SOS triggered for ride {ride_id}. Notified {contacts_notified} contacts. Police Notified: {notify_police}")

    except Exception as e:
        print(f"Error handling SOS: {e}")


# ── Community Space: channel chat events ──────────────────────────────────────

@socketio.on("join_channel")
def join_channel(data):
    """User joins a channel room to receive messages and proposal events."""
    channel_id = data.get("channel_id")
    if channel_id:
        join_room(f"channel_{channel_id}")
        emit("room_joined", {"room": f"channel_{channel_id}"})


@socketio.on("leave_channel")
def leave_channel(data):
    channel_id = data.get("channel_id")
    if channel_id:
        leave_room(f"channel_{channel_id}")


@socketio.on("typing_start")
def typing_start(data):
    channel_id = data.get("channel_id")
    user_id    = data.get("user_id")
    name       = data.get("name", "Someone")
    if channel_id:
        socketio.emit("user_typing", {"user_id": user_id, "name": name, "typing": True},
                      room=f"channel_{channel_id}", include_self=False)


@socketio.on("typing_stop")
def typing_stop(data):
    channel_id = data.get("channel_id")
    user_id    = data.get("user_id")
    if channel_id:
        socketio.emit("user_typing", {"user_id": user_id, "typing": False},
                      room=f"channel_{channel_id}", include_self=False)


# ── Community Space: WebRTC voice signalling ──────────────────────────────────

@socketio.on("join_voice")
def join_voice(data):
    """User joins the voice room for a channel. Others will initiate WebRTC offers."""
    channel_id = data.get("channel_id")
    user_id    = data.get("user_id")
    name       = data.get("name", "")
    if channel_id:
        join_room(f"voice_{channel_id}")
        # Notify existing participants so they initiate offers to the new joiner
        socketio.emit("voice_user_joined", {"user_id": user_id, "name": name},
                      room=f"voice_{channel_id}", include_self=False)


@socketio.on("leave_voice")
def leave_voice(data):
    channel_id = data.get("channel_id")
    user_id    = data.get("user_id")
    if channel_id:
        leave_room(f"voice_{channel_id}")
        socketio.emit("voice_user_left", {"user_id": user_id},
                      room=f"voice_{channel_id}")


@socketio.on("voice_offer")
def voice_offer(data):
    """Route a WebRTC offer from one peer to a specific target user."""
    to_user_id = data.get("to_user_id")
    if to_user_id:
        socketio.emit("voice_signal", {
            "from_user_id": data.get("from_user_id"),
            "type":         "offer",
            "sdp":          data.get("sdp"),
        }, room=f"passenger_{to_user_id}")


@socketio.on("voice_answer")
def voice_answer(data):
    """Route a WebRTC answer from one peer to a specific target user."""
    to_user_id = data.get("to_user_id")
    if to_user_id:
        socketio.emit("voice_signal", {
            "from_user_id": data.get("from_user_id"),
            "type":         "answer",
            "sdp":          data.get("sdp"),
        }, room=f"passenger_{to_user_id}")


@socketio.on("voice_ice_candidate")
def voice_ice_candidate(data):
    """Route an ICE candidate to a specific target user."""
    to_user_id = data.get("to_user_id")
    if to_user_id:
        socketio.emit("voice_signal", {
            "from_user_id": data.get("from_user_id"),
            "type":         "ice_candidate",
            "candidate":    data.get("candidate"),
        }, room=f"passenger_{to_user_id}")


@socketio.on("voice_mute_toggle")
def voice_mute_toggle(data):
    channel_id = data.get("channel_id")
    user_id    = data.get("user_id")
    muted      = data.get("muted", False)
    if channel_id:
        socketio.emit("voice_mute_changed", {"user_id": user_id, "muted": muted},
                      room=f"voice_{channel_id}")


# ── Group ride: stop completed by driver ──────────────────────────────────────

@socketio.on("stop_completed")
def stop_completed(data):
    """
    Driver marks a stop as completed (passenger picked up).
    data: {ride_id, user_id, stop_order}
    Notifies all participants in the ride's proposal channel.
    """
    ride_id    = data.get("ride_id")
    user_id    = data.get("user_id")
    stop_order = data.get("stop_order")

    if not ride_id:
        return

    try:
        from app.models.ride import Ride
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            return

        for stop in ride.stops:
            if stop.get("user_id") == user_id:
                stop["status"] = "picked_up"
                stop["picked_up_at"] = datetime.utcnow().isoformat()
                break

        ride.save()

        # Notify everyone tracking this ride
        socketio.emit("stop_completed", {
            "ride_id":    ride_id,
            "user_id":    user_id,
            "stop_order": stop_order,
        }, room=f"ride_{ride_id}")

        # Also notify the proposal channel if group ride
        if ride.proposal_id:
            from app.models.ride_proposal import RideProposal
            proposal = RideProposal.objects(id=ride.proposal_id.id).first()
            if proposal:
                channel_id = str(proposal.channel_id.id)
                name = next((s["name"] for s in ride.stops if s.get("user_id") == user_id), "A passenger")
                socketio.emit("new_message", {
                    "channel_id":   channel_id,
                    "sender_id":    None,
                    "sender_name":  "System",
                    "content":      f"{name} has been picked up (stop {stop_order}).",
                    "message_type": "system",
                    "created_at":   datetime.utcnow().isoformat(),
                    "deleted":      False,
                }, room=f"channel_{channel_id}")

    except Exception as e:
        print(f"Error in stop_completed: {e}")
