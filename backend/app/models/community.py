from mongoengine import (
    Document, StringField, BooleanField,
    ListField, ReferenceField, DateTimeField
)
from datetime import datetime


class Community(Document):
    meta = {"collection": "communities"}

    name         = StringField(required=True)
    email_domain = StringField(required=True, unique=True)
    member_ids   = ListField(ReferenceField("User"))
    women_only   = BooleanField(default=False)
    created_at   = DateTimeField(default=datetime.utcnow)

    def to_json_safe(self):
        return {
            "id":           str(self.id),
            "name":         self.name,
            "email_domain": self.email_domain,
            "member_count": len(self.member_ids),
            "women_only":   self.women_only,
            "created_at":   self.created_at.isoformat(),
        }

    def ensure_space(self):
        """Auto-create a Space with default channels if one doesn't exist yet."""
        from app.models.space import Space
        from app.models.channel import Channel

        existing = Space.objects(community_id=self).first()
        if existing:
            return existing

        space = Space(community_id=self, name=self.name, channels=[])
        space.save()

        for ch_name, desc, is_default in [
            ("general",        "Open community chat",          True),
            ("ride-proposals", "Coordinate group rides here",  True),
            ("announcements",  "Community-wide notices",       True),
        ]:
            ch = Channel(
                space_id=space,
                name=ch_name,
                description=desc,
                is_default=is_default,
            )
            ch.save()
            space.channels.append(ch)

        space.save()
        return space
