#!/usr/bin/env python3
"""Quick test script for chatbot"""
import sys
sys.path.insert(0, '/Users/nidhi/case_study_backend/backend')

from app.ml.chatbot.predict import predict_intent, get_response

# Test messages
test_messages = [
    "Hello",
    "i want to book a ride",
    "Book a cab",
    "I need a ride",
    "Cancel my ride",
    "EV ride please"
]

print("=" * 60)
print("CHATBOT TEST")
print("=" * 60)

for msg in test_messages:
    print(f"\nUser: {msg}")
    intent, confidence = predict_intent(msg)
    response, action, context = get_response(intent, confidence, msg, {})
    print(f"Intent: {intent} (confidence: {confidence:.2f})")
    print(f"Bot: {response}")
    if action:
        print(f"Action: {action}")
    print("-" * 60)
