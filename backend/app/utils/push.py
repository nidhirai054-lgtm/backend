"""
Web Push notification helper.

send_push(user_id, title, body, url="/", data={})
  → Fetches all PushSubscription documents for the user
  → Calls pywebpush.webpush() for each
  → Silently removes expired/invalid subscriptions

VAPID keys are read from environment:
  VAPID_PRIVATE_KEY  — base64url-encoded private key
  VAPID_PUBLIC_KEY   — base64url-encoded public key
  VAPID_CLAIM_EMAIL  — mailto: claim for VAPID (e.g. mailto:admin@smartride.app)

Generate keys with:
  python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.private_key.export_key('PEM')); print(v.public_key.export_key('PEM'))"
or use:  https://vapidkeys.com
"""

import os
import json
import threading
from app.models.push_subscription import PushSubscription

VAPID_PRIVATE_KEY  = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY   = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CLAIM_EMAIL  = os.getenv("VAPID_CLAIM_EMAIL", "mailto:admin@smartride.app")


def _send_single(sub: PushSubscription, payload: dict):
    """Send push to one subscription. Remove if expired/invalid (410)."""
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth":   sub.auth,
                },
            },
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIM_EMAIL},
        )
    except Exception as exc:
        err_str = str(exc)
        # 410 Gone = subscription is no longer valid, clean it up
        if "410" in err_str or "404" in err_str:
            print(f"[Push] Removing stale subscription: {sub.endpoint[:60]}")
            sub.delete()
        else:
            print(f"[Push] Failed to send to {sub.endpoint[:60]}: {exc}")


def send_push(user_id: str, title: str, body: str, url: str = "/", data: dict = None):
    """
    Asynchronously send a Web Push notification to all devices registered
    for the given user. Runs in background threads to avoid blocking the
    request/socket handler.

    Args:
        user_id: MongoDB string ID of the recipient user
        title:   Notification title
        body:    Notification body text
        url:     URL to open on notification click
        data:    Extra structured data (merged into payload)
    """
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        print("[Push] VAPID keys not configured — skipping push notification")
        return

    try:
        subscriptions = PushSubscription.objects(user_id=user_id)
    except Exception as exc:
        print(f"[Push] DB error fetching subscriptions: {exc}")
        return

    payload = {
        "title": title,
        "body":  body,
        "url":   url,
        **(data or {}),
    }

    for sub in subscriptions:
        t = threading.Thread(target=_send_single, args=(sub, payload), daemon=True)
        t.start()
