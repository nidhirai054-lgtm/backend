from mongoengine import Document, StringField, ReferenceField, BooleanField, DateTimeField
from datetime import datetime


class Message(Document):
    meta = {"collection": "messages", "indexes": ["channel_id", "-created_at"]}

    channel_id       = ReferenceField("Channel", required=True)
    sender_id        = ReferenceField("User", required=True)
    content          = StringField(default="")
    message_type     = StringField(
                           default="text",
                           choices=["text", "ride_proposal", "system"]
                       )
    ride_proposal_id = ReferenceField("RideProposal", null=True)
    created_at       = DateTimeField(default=datetime.utcnow)
    edited_at        = DateTimeField(null=True)
    deleted          = BooleanField(default=False)

    def to_json_safe(self):
        sender = self.sender_id
        return {
            "id":               str(self.id),
            "channel_id":       str(self.channel_id.id),
            "sender_id":        str(sender.id) if sender else None,
            "sender_name":      sender.name if sender else "Unknown",
            "content":          self.content if not self.deleted else "",
            "message_type":     self.message_type,
            "ride_proposal_id": str(self.ride_proposal_id.id) if self.ride_proposal_id else None,
            "created_at":       self.created_at.isoformat(),
            "edited_at":        self.edited_at.isoformat() if self.edited_at else None,
            "deleted":          self.deleted,
        }
