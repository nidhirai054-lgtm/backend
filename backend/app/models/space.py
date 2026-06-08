from mongoengine import Document, StringField, ReferenceField, ListField, DateTimeField
from datetime import datetime


class Space(Document):
    meta = {"collection": "spaces"}

    community_id = ReferenceField("Community", required=True, unique=True)
    name         = StringField(required=True)
    channels     = ListField(ReferenceField("Channel"))
    created_at   = DateTimeField(default=datetime.utcnow)

    def to_json_safe(self):
        return {
            "id":           str(self.id),
            "community_id": str(self.community_id.id),
            "name":         self.name,
            "channel_ids":  [str(c.id) for c in (self.channels or [])],
            "created_at":   self.created_at.isoformat(),
        }
