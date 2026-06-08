"""
SMS / notification stub for SOS alerts.

Replace the body of send_sos_sms() with a real provider call when ready:
  - Twilio:  client.messages.create(to=phone, from_=FROM, body=message)
  - MSG91:   requests.post(MSG91_URL, json={...})
  - AWS SNS: sns.publish(PhoneNumber=phone, Message=message)
"""

def send_whatsapp_alert(phone: str, message: str) -> bool:
    """
    Local logging helper for WhatsApp alerts.
    """
    print(f"\n[WhatsApp SOS Local Log] Phone: {phone}\nMessage:\n{message}\n")
    return True


def build_whatsapp_sos_message(passenger_name: str, location_url: str, ride_id: str, pickup: str, dropoff: str, driver_name: str, driver_vehicle: str) -> str:
    """Build the rich Markdown WhatsApp text sent to emergency contacts."""
    return (
        f"🚨 *EMERGENCY ALERT from SmartRide* 🚨\n\n"
        f"*{passenger_name}* has triggered an SOS during their ride.\n\n"
        f"📍 *Live Tracking:*\n{location_url}\n\n"
        f"🚗 *Ride Details:*\n"
        f"• *Driver:* {driver_name}\n"
        f"• *Vehicle:* {driver_vehicle}\n"
        f"• *From:* {pickup}\n"
        f"• *To:* {dropoff}\n"
        f"• *Ride ID:* {ride_id}\n\n"
        f"Please check on them immediately or call *112*."
    )


def build_location_url(lat: float, lng: float) -> str:
    """Return a Google Maps URL for the given coordinates."""
    if lat and lng:
        return f"https://maps.google.com/?q={lat},{lng}"
    return "Location unavailable"


def alert_police_control_room(ride_id: str, location_url: str) -> bool:
    """
    Stub to call the City Police API (e.g., E-Challan / Dial 100 API).
    Logs the alert locally instead of actually firing an HTTP request.
    """
    print(f"🚨 [POLICE API STUB] Firing emergency alert to control room for Ride ID: {ride_id}")
    print(f"🚨 [POLICE API STUB] Location provided: {location_url}")
    return True
