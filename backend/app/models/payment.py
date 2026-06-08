from mongoengine import (
    Document, StringField, IntField, ReferenceField, DateTimeField
)
from datetime import datetime


class Payment(Document):
    """
    Tracks a Razorpay payment linked to a Ride.

    Lifecycle:
      created  → Razorpay order created, awaiting user action
      paid     → Razorpay signature verified, payment successful
      failed   → Payment failed or signature mismatch
    """
    meta = {"collection": "payments"}

    ride_id              = ReferenceField("Ride", required=True)
    passenger_id         = ReferenceField("User", required=True)

    # Razorpay identifiers
    razorpay_order_id    = StringField(required=True, unique=True)
    razorpay_payment_id  = StringField(null=True)
    razorpay_signature   = StringField(null=True)

    # Amount in paise (₹1 = 100 paise) — stored as integer to avoid float issues
    amount_paise         = IntField(required=True)
    currency             = StringField(default="INR")

    status               = StringField(
                               default="created",
                               choices=["created", "paid", "failed"]
                           )

    created_at           = DateTimeField(default=datetime.utcnow)
    paid_at              = DateTimeField(null=True)

    def to_json_safe(self):
        return {
            "id":                   str(self.id),
            "ride_id":              str(self.ride_id.id) if hasattr(self.ride_id, "id") else str(self.ride_id),
            "passenger_id":         str(self.passenger_id.id) if hasattr(self.passenger_id, "id") else str(self.passenger_id),
            "razorpay_order_id":    self.razorpay_order_id,
            "razorpay_payment_id":  self.razorpay_payment_id,
            "amount_paise":         self.amount_paise,
            "amount_inr":           self.amount_paise / 100,
            "currency":             self.currency,
            "status":               self.status,
            "created_at":           self.created_at.isoformat(),
            "paid_at":              self.paid_at.isoformat() if self.paid_at else None,
        }
