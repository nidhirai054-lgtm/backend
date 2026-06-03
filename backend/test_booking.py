#!/usr/bin/env python3
"""
Test ride booking endpoint
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models.user import User
from flask_jwt_extended import create_access_token
import json

def test_booking():
    app = create_app()
    
    with app.app_context():
        # Get passenger user
        passenger = User.objects(email='nidhi@google.com').first()
        if not passenger:
            print("❌ Passenger user not found")
            return
        
        # Create JWT token
        token = create_access_token(identity=str(passenger.id))
        
        # Test data
        booking_data = {
            'pickup': {
                'lat': 12.9352,
                'lng': 77.6245,
                'address': 'Koramangala, Bangalore'
            },
            'dropoff': {
                'lat': 12.9698,
                'lng': 77.7500,
                'address': 'Whitefield, Bangalore'
            },
            'ride_type': 'solo',
            'women_only': False
        }
        
        # Test with Flask test client
        with app.test_client() as client:
            response = client.post(
                '/api/rides/book',
                json=booking_data,
                headers={'Authorization': f'Bearer {token}'}
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json, indent=2)}")
            
            if response.status_code == 201:
                print("\n✅ Booking successful!")
                ride_id = response.json['ride']['id']
                print(f"📍 Ride ID: {ride_id}")
                return ride_id
            else:
                print("\n❌ Booking failed!")
                return None

if __name__ == "__main__":
    test_booking()
