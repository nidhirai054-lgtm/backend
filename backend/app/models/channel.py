from mongoengine import Document, StringField, ReferenceField, BooleanField, DateTimeField
from datetime import datetime, timezone


def _utcnow():
    return datetime.now(timezone.utc)


class Channel(Document):
    meta = {"collection": "channels"}

    space_id     = ReferenceField("Space", required=True)
    name         = StringField(required=True)
    description  = StringField(default="")
    channel_type = StringField(default="text", choices=["text", "voice"])  # text | voice
    is_default   = BooleanField(default=False)
    created_by   = ReferenceField("User", null=True)
    created_at   = DateTimeField(default=_utcnow)

    def to_json_safe(self):
        return {
            "id":           str(self.id),
            "space_id":     str(self.space_id.id),
            "name":         self.name,
            "description":  self.description,
            "channel_type": self.channel_type or "text",
            "is_default":   self.is_default,
            "created_by":   str(self.created_by.id) if self.created_by else None,
            "created_at":   self.created_at.isoformat(),
        }
