from mongoengine import (
    Document, StringField, ReferenceField, BooleanField,
    DateTimeField, DictField, IntField, ListField
)
from datetime import datetime


class RideProposal(Document):
    meta = {"collection": "ride_proposals", "indexes": ["channel_id", "community_id"]}

    channel_id       = ReferenceField("Channel", required=True)
    community_id     = ReferenceField("Community", required=True)
    organiser_id     = ReferenceField("User", required=True)

    destination      = DictField(required=True)   # {lat, lng, address}
    proposed_time    = DateTimeField(required=True)
    ride_type        = StringField(default="pooled", choices=["pooled", "EV"])
    women_only       = BooleanField(default=False)
    max_participants = IntField(default=4)

    status           = StringField(
                           default="open",
                           choices=["open", "locked", "searching", "active", "completed", "cancelled"]
                       )

    # List of participant dicts:
    # {user_id, name, pickup: {lat,lng,address}, status, stop_order, individual_fare}
    participants     = ListField(DictField())

    # Populated on lock — computed multi-stop route
    # {stops: [{user_id, name, pickup, stop_order, eta_from_prev_stop}],
    #  total_distance_km, total_duration_minutes, polyline}
    route_plan       = DictField(null=True)

    ride_id          = ReferenceField("Ride", null=True)

    created_at       = DateTimeField(default=datetime.utcnow)
    locked_at        = DateTimeField(null=True)
    dispatched_at    = DateTimeField(null=True)

    def to_json_safe(self):
        organiser = self.organiser_id
        return {
            "id":               str(self.id),
            "channel_id":       str(self.channel_id.id),
            "community_id":     str(self.community_id.id),
            "organiser_id":     str(organiser.id) if organiser else None,
            "organiser_name":   organiser.name if organiser else "Unknown",
            "destination":      self.destination,
            "proposed_time":    self.proposed_time.isoformat(),
            "ride_type":        self.ride_type,
            "women_only":       self.women_only,
            "max_participants": self.max_participants,
            "status":           self.status,
            "participants":     self.participants,
            "route_plan":       self.route_plan,
            "ride_id":          str(self.ride_id.id) if self.ride_id else None,
            "created_at":       self.created_at.isoformat(),
            "locked_at":        self.locked_at.isoformat() if self.locked_at else None,
            "dispatched_at":    self.dispatched_at.isoformat() if self.dispatched_at else None,
        }
