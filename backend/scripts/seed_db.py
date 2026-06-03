import bcrypt
import os
import sys
from datetime import datetime
from mongoengine import connect

# Add the backend directory to sys.path to import models
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.models.user import User
from app.models.community import Community
from app.models.ride import Ride
from app.models.alert import Alert

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/rideshare")

def seed():
    print("Connecting to MongoDB...")
    connect(host=MONGO_URI)

    print("Cleaning database...")
    User.objects.delete()
    Community.objects.delete()
    Ride.objects.delete()
    Alert.objects.delete()

    # --- 1. Create Communities ---
    print("Creating communities...")
    google_comm = Community(
        name="Google Office (Bangalore)",
        email_domain="google.com",
        women_only=False
    ).save()

    uni_comm = Community(
        name="Presidency University",
        email_domain="presidency.edu.in",
        women_only=False
    ).save()

    # --- 2. Create Admin ---
    print("Creating admin user...")
    password = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
    admin = User(
        name="System Admin",
        email="admin@rideshare.com",
        password_hash=password,
        role="admin"
    ).save()

    # --- 3. Create Drivers ---
    print("Creating drivers...")
    driver_data = [
        # Nearby Bangalore (Safe Zone)
        {"name": "Rajesh Kumar", "email": "rajesh@google.com", "community": google_comm, "lat": 12.9716, "lng": 77.5946, "rating": 4.8},
        {"name": "Sneha Reddy", "email": "sneha@google.com", "community": google_comm, "lat": 12.9720, "lng": 77.5950, "rating": 4.9, "gender": "female"},
        
        # Risk Zone Alpha (Delhi)
        {"name": "Amit Singh", "email": "amit@driver.com", "community": None, "lat": 28.55, "lng": 77.15, "rating": 3.5},
        
        # Risk Zone Beta (Mumbai)
        {"name": "Suresh Raina", "email": "suresh@driver.com", "community": None, "lat": 19.05, "lng": 72.85, "rating": 4.2},
        
        # EV Driver
        {"name": "Vijay Mallya", "email": "vijay@ev.com", "community": uni_comm, "lat": 12.9300, "lng": 77.6100, "rating": 4.5, "vehicle": "EV"},
    ]

    for d in driver_data:
        pwd = bcrypt.hashpw("driver123".encode(), bcrypt.gensalt()).decode()
        user = User(
            name=d["name"],
            email=d["email"],
            password_hash=pwd,
            role="driver",
            gender=d.get("gender", "male"),
            vehicle_type=d.get("vehicle"),
            community_id=d["community"],
            last_lat=d["lat"],
            last_lng=d["lng"],
            avg_rating=d["rating"],
            reputation_score=d["rating"] * 10
        ).save()
        if d["community"]:
            d["community"].update(push__member_ids=user)

    # --- 4. Create Passengers ---
    print("Creating passengers...")
    passengers = [
        {"name": "Nidhi Rai", "email": "nidhi@google.com", "community": google_comm},
        {"name": "John Doe", "email": "john@presidency.edu.in", "community": uni_comm},
    ]

    for p in passengers:
        pwd = bcrypt.hashpw("pass123".encode(), bcrypt.gensalt()).decode()
        user = User(
            name=p["name"],
            email=p["email"],
            password_hash=pwd,
            role="passenger",
            community_id=p["community"],
            green_points=100
        ).save()
        if p["community"]:
            p["community"].update(push__member_ids=user)

    print("Database seeded successfully!")

if __name__ == "__main__":
    seed()
