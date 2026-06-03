from mongoengine import (
    Document, StringField, FloatField, IntField,
    BooleanField, ReferenceField, DateTimeField, DictField
)
from datetime import datetime


class Ride(Document):
    meta = {"collection": "rides"}

    passenger_id       = ReferenceField("User", required=True)
    driver_id          = ReferenceField("User", null=True)
    pickup             = DictField(required=True)   # {lat, lng, address}
    dropoff            = DictField(required=True)   # {lat, lng, address}
    status             = StringField(
                            default="searching",
                            choices=["searching", "driver_assigned", "driver_arriving", "in_progress", "completed", "cancelled"]
                         )
    ride_type          = StringField(default="solo", choices=["solo", "pooled", "EV"])
    risk_score         = FloatField(default=0.0)
    risk_label         = StringField(default="green", choices=["green", "yellow", "red"])
    co2_saved          = FloatField(default=0.0)
    green_points_awarded = IntField(default=0)
    fare               = FloatField(default=0.0)
    distance_km        = FloatField(default=0.0)
    women_only         = BooleanField(default=False)
    pool_passengers    = IntField(default=1)
    
    # New routing fields
    route_polyline     = StringField(null=True)
    estimated_duration_minutes = IntField(default=0)
    surge_multiplier   = FloatField(default=1.0)
    
    # Driver location tracking
    driver_current_location = DictField(null=True)  # {lat, lng, timestamp}
    actual_eta_minutes = IntField(null=True)
    
    created_at         = DateTimeField(default=datetime.utcnow)
    completed_at       = DateTimeField(null=True)

    def to_json_safe(self):
        passenger_id_str = None
        if self.passenger_id:
            passenger_id_str = str(self.passenger_id.id) if hasattr(self.passenger_id, 'id') else str(self.passenger_id)
        
        driver_id_str = None
        if self.driver_id:
            driver_id_str = str(self.driver_id.id) if hasattr(self.driver_id, 'id') else str(self.driver_id)
        
        return {
            "id": str(self.id),
            "passenger_id": passenger_id_str,
            "driver_id": driver_id_str,
            "pickup": self.pickup,
            "dropoff": self.dropoff,
            "status": self.status,
            "ride_type": self.ride_type,
            "risk_score": self.risk_score,
            "risk_label": self.risk_label,
            "co2_saved": self.co2_saved,
            "green_points_awarded": self.green_points_awarded,
            "fare": self.fare,
            "distance_km": self.distance_km,
            "women_only": self.women_only,
            "pool_passengers": self.pool_passengers,
            "route_polyline": self.route_polyline,
            "estimated_duration_minutes": self.estimated_duration_minutes,
            "surge_multiplier": self.surge_multiplier,
            "created_at": self.created_at.isoformat(),
        }
