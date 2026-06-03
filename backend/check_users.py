#!/usr/bin/env python3
"""Check and create test users"""

import os
import bcrypt
from mongoengine import connect
from dotenv import load_dotenv

load_dotenv()

# Import after load_dotenv
from app.models.user import User

# Connect to MongoDB
mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/smartride')
connect(host=mongo_uri)

print("=== Current Users in Database ===")
users = User.objects()
if not users:
    print("No users found!")
else:
    for u in users:
        print(f"  ID: {u.id}")
        print(f"  Name: {u.name}")
        print(f"  Email: {u.email}")
        print(f"  Role: {u.role}")
        print(f"  Active: {u.is_active}")
        print("-" * 40)

# Create test users if none exist
if not users:
    print("\n=== Creating Test Users ===")
    
    # Create passenger
    passenger_pass = bcrypt.hashpw("password123".encode(), bcrypt.gensalt()).decode()
    passenger = User(
        name="Test Passenger",
        email="passenger@test.com",
        password_hash=passenger_pass,
        role="passenger",
        gender="other",
        is_active=True,
        last_lat=12.9716,
        last_lng=77.5946
    )
    passenger.save()
    print(f"✓ Created passenger: {passenger.email} (password: password123)")
    
    # Create driver
    driver_pass = bcrypt.hashpw("password123".encode(), bcrypt.gensalt()).decode()
    driver = User(
        name="Test Driver",
        email="driver@test.com",
        password_hash=driver_pass,
        role="driver",
        gender="male",
        vehicle_type="petrol",
        is_active=True,
        last_lat=12.9716,
        last_lng=77.5946
    )
    driver.save()
    print(f"✓ Created driver: {driver.email} (password: password123)")
    
    print("\n=== Login with these credentials ===")
    print("Passenger: passenger@test.com / password123")
    print("Driver: driver@test.com / password123")
