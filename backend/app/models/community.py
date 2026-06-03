from mongoengine import (
    Document, StringField, BooleanField,
    ListField, ReferenceField, DateTimeField
)
from datetime import datetime


class Community(Document):
    meta = {"collection": "communities"}

    name         = StringField(required=True)
    email_domain = StringField(required=True, unique=True)  # e.g. "presidency.edu.in"
    member_ids   = ListField(ReferenceField("User"))
    women_only   = BooleanField(default=False)
    created_at   = DateTimeField(default=datetime.utcnow)

    def to_json_safe(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "email_domain": self.email_domain,
            "member_count": len(self.member_ids),
            "women_only": self.women_only,
            "created_at": self.created_at.isoformat(),
        }
