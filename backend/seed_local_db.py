#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bcrypt
from app import create_app
from app.models.user import User

app = create_app()

with app.app_context():
    # Clear existing user if any
    User.objects(email="ananya@google.com").delete()
    
    # Create test user
    hashed = bcrypt.hashpw("ananya123".encode(), bcrypt.gensalt()).decode()
    
    user = User(
        name="Ananya Sharma",
        email="ananya@google.com",
        password_hash=hashed,
        role="passenger",
        gender="female",
        is_active=True
    )
    user.save()
    
    print("✅ Local database seeded successfully!")
    print("\n=== LOGIN CREDENTIALS ===")
    print("Email: ananya@google.com")
    print("Password: ananya123")
    print("========================\n")
