from mongoengine import (
    Document, StringField, FloatField, IntField,
    BooleanField, ReferenceField, DateTimeField, ListField
)
from datetime import datetime


class User(Document):
    meta = {"collection": "users"}

    name           = StringField(required=True, max_length=100)
    email          = StringField(required=True, unique=True)
    password_hash  = StringField(required=True)
    role           = StringField(default="passenger", choices=["passenger", "driver", "admin"])
    gender         = StringField(choices=["male", "female", "other"], default="other")
    vehicle_type   = StringField(choices=["EV", "petrol", None], default=None)
    community_id   = ReferenceField("Community", null=True)
    reputation_score = FloatField(default=0.0)
    green_points   = IntField(default=0)
    avg_rating     = FloatField(default=5.0)
    is_active      = BooleanField(default=True)
    last_lat       = FloatField(default=0.0)
    last_lng       = FloatField(default=0.0)
    created_at     = DateTimeField(default=datetime.utcnow)

    def to_json_safe(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "gender": self.gender,
            "vehicle_type": self.vehicle_type,
            "reputation_score": self.reputation_score,
            "green_points": self.green_points,
            "avg_rating": self.avg_rating,
            "created_at": self.created_at.isoformat(),
        }
