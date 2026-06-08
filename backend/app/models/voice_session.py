from mongoengine import Document, ReferenceField, BooleanField, DateTimeField, ListField, DictField
from datetime import datetime, timezone


def _utcnow():
    return datetime.now(timezone.utc)


class VoiceSession(Document):
    meta = {"collection": "voice_sessions", "indexes": ["channel_id"]}

    channel_id   = ReferenceField("Channel", required=True)
    # Each entry: {user_id, name, joined_at, muted}
    participants = ListField(DictField())
    is_active    = BooleanField(default=True)
    started_at   = DateTimeField(default=_utcnow)
    ended_at     = DateTimeField(null=True)

    def to_json_safe(self):
        return {
            "id":           str(self.id),
            "channel_id":   str(self.channel_id.id),
            "participants": self.participants,
            "is_active":    self.is_active,
            "started_at":   self.started_at.isoformat(),
            "ended_at":     self.ended_at.isoformat() if self.ended_at else None,
        }
