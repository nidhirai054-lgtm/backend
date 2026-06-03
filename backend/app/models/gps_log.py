from mongoengine import (
    Document, FloatField, ReferenceField, DateTimeField
)
from datetime import datetime


class GPSLog(Document):
    meta = {
        "collection": "gps_logs",
        "indexes": [
            {"fields": ["driver_id", "-timestamp"]},
            {"fields": ["ride_id", "-timestamp"]},
        ]
    }

    ride_id    = ReferenceField("Ride", required=True)
    driver_id  = ReferenceField("User", required=True)
    lat        = FloatField(required=True)
    lng        = FloatField(required=True)
    speed_kmh  = FloatField(default=0.0)
    heading    = FloatField(default=0.0)   # degrees 0–360
    timestamp  = DateTimeField(default=datetime.utcnow)

    def to_json_safe(self):
        return {
            "id": str(self.id),
            "ride_id": str(self.ride_id.id) if self.ride_id else None,
            "driver_id": str(self.driver_id.id) if self.driver_id else None,
            "lat": self.lat,
            "lng": self.lng,
            "speed_kmh": self.speed_kmh,
            "heading": self.heading,
            "timestamp": self.timestamp.isoformat(),
        }
