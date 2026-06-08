from mongoengine import (
    Document, StringField, FloatField,
    BooleanField, ReferenceField, DateTimeField
)
from datetime import datetime


class Alert(Document):
    meta = {"collection": "alerts"}

    ride_id      = ReferenceField("Ride", required=True)
    driver_id    = ReferenceField("User", required=True)
    alert_type   = StringField(
                        required=True,
                        choices=["route_deviation", "unusual_stop", "speed_violation", "sos"]
                   )
    anomaly_score = FloatField(required=True)
    notified_contacts = BooleanField(default=True)
    notified_police   = BooleanField(default=False)
    resolved     = BooleanField(default=False)
    resolved_by  = ReferenceField("User", null=True)
    created_at   = DateTimeField(default=datetime.utcnow)

    def to_json_safe(self):
        return {
            "id": str(self.id),
            "ride_id": str(self.ride_id.id) if self.ride_id else None,
            "driver_id": str(self.driver_id.id) if self.driver_id else None,
            "alert_type": self.alert_type,
            "anomaly_score": self.anomaly_score,
            "notified_contacts": self.notified_contacts,
            "notified_police": self.notified_police,
            "resolved": self.resolved,
            "created_at": self.created_at.isoformat(),
        }
