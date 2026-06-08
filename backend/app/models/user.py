from mongoengine import (
    Document, StringField, FloatField, IntField,
    BooleanField, ReferenceField, DateTimeField, ListField,
    EmbeddedDocument, EmbeddedDocumentField
)
from datetime import datetime


class EmergencyContact(EmbeddedDocument):
    """A single emergency contact stored on a User document."""
    name             = StringField(required=True, max_length=80)
    phone            = StringField(required=True, max_length=20)
    relationship     = StringField(default="", max_length=40)  # e.g. "Mother", "Friend"
    notify_sms       = BooleanField(default=True)
    notify_push      = BooleanField(default=True)

    def to_dict(self):
        return {
            "name":             self.name,
            "phone":            self.phone,
            "relationship":     self.relationship,
            "notify_sms":       self.notify_sms,
            "notify_push":      self.notify_push,
        }


class User(Document):
    meta = {"collection": "users"}

    name           = StringField(required=True, max_length=100)
    email          = StringField(required=True, unique=True)
    password_hash  = StringField(required=True)
    role           = StringField(default="passenger", choices=["passenger", "driver", "admin"])
    gender         = StringField(choices=["male", "female", "other"], default="other")
    phone          = StringField(default="", max_length=20)
    vehicle_type   = StringField(choices=["EV", "petrol", None], default=None)
    community_id   = ReferenceField("Community", null=True)
    reputation_score = FloatField(default=0.0)
    green_points   = IntField(default=0)
    avg_rating     = FloatField(default=5.0)
    is_active      = BooleanField(default=True)
    last_lat       = FloatField(default=0.0)
    last_lng       = FloatField(default=0.0)
    created_at     = DateTimeField(default=datetime.utcnow)

    # Emergency contacts for SOS notifications (up to 3 recommended)
    emergency_contacts = ListField(EmbeddedDocumentField(EmergencyContact), default=list)

    def to_json_safe(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "gender": self.gender,
            "phone": self.phone or "",
            "vehicle_type": self.vehicle_type,
            "reputation_score": self.reputation_score,
            "green_points": self.green_points,
            "avg_rating": self.avg_rating,
            "created_at": self.created_at.isoformat(),
            "emergency_contacts": [c.to_dict() for c in (self.emergency_contacts or [])],
        }
