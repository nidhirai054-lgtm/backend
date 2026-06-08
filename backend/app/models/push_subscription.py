from mongoengine import Document, StringField, ReferenceField, DateTimeField
from datetime import datetime


class PushSubscription(Document):
    """
    Stores a Web Push API subscription for a user.
    One user can have multiple subscriptions (different browsers/devices).
    The endpoint is unique — duplicate subscriptions are upserted, not duplicated.
    """
    meta = {"collection": "push_subscriptions"}

    user_id    = ReferenceField("User", required=True)
    endpoint   = StringField(required=True, unique=True)
    p256dh     = StringField(required=True)   # Public key
    auth       = StringField(required=True)   # Auth secret
    created_at = DateTimeField(default=datetime.utcnow)

    def to_json_safe(self):
        return {
            "id":         str(self.id),
            "user_id":    str(self.user_id.id) if hasattr(self.user_id, "id") else str(self.user_id),
            "endpoint":   self.endpoint,
            "created_at": self.created_at.isoformat(),
        }
