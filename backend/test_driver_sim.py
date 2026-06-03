#!/usr/bin/env python3
"""
Quick test script for driver simulation
Usage: python test_driver_sim.py <ride_id>
"""

import sys
import os
import subprocess

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_jwt_token():
    """Get JWT token for driver user"""
    from app import create_app
    from app.models.user import User
    from flask_jwt_extended import create_access_token
    
    app = create_app()
    with app.app_context():
        # Find a driver user
        driver = User.objects(role='driver').first()
        if not driver:
            print("❌ No driver user found in database")
            return None
        
        token = create_access_token(identity=str(driver.id))
        print(f"✅ Using driver: {driver.name} ({driver.email})")
        return token

def get_ride_details(ride_id):
    """Get ride pickup/dropoff coordinates"""
    from app import create_app
    from app.models.ride import Ride
    
    app = create_app()
    with app.app_context():
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            print(f"❌ Ride {ride_id} not found")
            return None
        
        print(f"✅ Found ride: {ride.pickup.get('address')} → {ride.dropoff.get('address')}")
        return {
            'pickup_lat': ride.pickup['lat'],
            'pickup_lng': ride.pickup['lng'],
            'dropoff_lat': ride.dropoff['lat'],
            'dropoff_lng': ride.dropoff['lng']
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_driver_sim.py <ride_id>")
        sys.exit(1)
    
    ride_id = sys.argv[1]
    
    print(f"\n🚗 Starting driver simulation for ride {ride_id}\n")
    
    # Get JWT token
    token = get_jwt_token()
    if not token:
        sys.exit(1)
    
    # Get ride details
    ride_details = get_ride_details(ride_id)
    if not ride_details:
        sys.exit(1)
    
    # Run simulator
    print("\n🎬 Starting simulation...\n")
    
    cmd = [
        'python', 'scripts/simulate_driver.py',
        '--ride-id', ride_id,
        '--pickup-lat', str(ride_details['pickup_lat']),
        '--pickup-lng', str(ride_details['pickup_lng']),
        '--dropoff-lat', str(ride_details['dropoff_lat']),
        '--dropoff-lng', str(ride_details['dropoff_lng']),
        '--token', token,
        '--server', 'http://localhost:5000'
    ]
    
    subprocess.run(cmd)
