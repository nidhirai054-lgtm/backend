#!/usr/bin/env python3
"""
Driver Location Simulator
Simulates a driver moving from pickup to dropoff location
Emits location updates via Socket.IO
"""

import sys
import time
import math
from socketio import Client
import argparse

def interpolate_position(start, end, progress):
    """Linear interpolation between two points"""
    lat = start['lat'] + (end['lat'] - start['lat']) * progress
    lng = start['lng'] + (end['lng'] - start['lng']) * progress
    return {'lat': lat, 'lng': lng}

def calculate_bearing(start, end):
    """Calculate bearing/heading from start to end point"""
    d_lng = end['lng'] - start['lng']
    d_lat = end['lat'] - start['lat']
    bearing = math.atan2(d_lng, d_lat) * (180 / math.pi)
    return bearing

def simulate_driver(ride_id, pickup, dropoff, token, server_url='http://localhost:5000'):
    """
    Simulate driver movement from pickup to dropoff
    
    Args:
        ride_id: Ride ID to update
        pickup: Dict with lat, lng
        dropoff: Dict with lat, lng
        token: JWT token for authentication
        server_url: Backend server URL
    """
    
    sio = Client()
    
    @sio.event
    def connect():
        print(f"✅ Connected to server")
    
    @sio.event
    def disconnect():
        print(f"❌ Disconnected from server")
    
    @sio.event
    def connected(data):
        print(f"📡 {data.get('message')}")
    
    try:
        # Connect with JWT token
        sio.connect(server_url, auth={'token': token})
        time.sleep(1)
        
        print(f"\n🚗 Starting driver simulation for ride {ride_id}")
        print(f"📍 Pickup: {pickup['lat']:.4f}, {pickup['lng']:.4f}")
        print(f"🏁 Dropoff: {dropoff['lat']:.4f}, {dropoff['lng']:.4f}\n")
        
        # Phase 1: Driver arriving at pickup (30 steps over 60 seconds)
        print("🔵 Phase 1: Driver arriving at pickup...")
        for i in range(31):
            progress = i / 30
            current_pos = interpolate_position(
                {'lat': pickup['lat'] - 0.01, 'lng': pickup['lng'] - 0.01},  # Start slightly away
                pickup,
                progress
            )
            heading = calculate_bearing(current_pos, pickup)
            
            sio.emit('update_driver_location', {
                'ride_id': ride_id,
                'lat': current_pos['lat'],
                'lng': current_pos['lng'],
                'heading': heading
            })
            
            print(f"  📍 {i*100//30}% to pickup - Lat: {current_pos['lat']:.6f}, Lng: {current_pos['lng']:.6f}")
            time.sleep(2)
        
        # Update status to driver_arriving
        sio.emit('update_ride_status', {
            'ride_id': ride_id,
            'status': 'driver_arriving'
        })
        print("✅ Arrived at pickup!\n")
        time.sleep(3)
        
        # Update status to in_progress
        sio.emit('update_ride_status', {
            'ride_id': ride_id,
            'status': 'in_progress'
        })
        print("🟢 Phase 2: Trip in progress to dropoff...")
        
        # Phase 2: Moving to dropoff (50 steps over 100 seconds)
        for i in range(51):
            progress = i / 50
            current_pos = interpolate_position(pickup, dropoff, progress)
            heading = calculate_bearing(current_pos, dropoff)
            
            sio.emit('update_driver_location', {
                'ride_id': ride_id,
                'lat': current_pos['lat'],
                'lng': current_pos['lng'],
                'heading': heading
            })
            
            print(f"  📍 {i*100//50}% to dropoff - Lat: {current_pos['lat']:.6f}, Lng: {current_pos['lng']:.6f}")
            time.sleep(2)
        
        # Update status to completed
        sio.emit('update_ride_status', {
            'ride_id': ride_id,
            'status': 'completed'
        })
        print("\n🏁 Trip completed!")
        
        time.sleep(2)
        sio.disconnect()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sio.disconnect()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Simulate driver location updates')
    parser.add_argument('--ride-id', required=True, help='Ride ID')
    parser.add_argument('--pickup-lat', type=float, required=True, help='Pickup latitude')
    parser.add_argument('--pickup-lng', type=float, required=True, help='Pickup longitude')
    parser.add_argument('--dropoff-lat', type=float, required=True, help='Dropoff latitude')
    parser.add_argument('--dropoff-lng', type=float, required=True, help='Dropoff longitude')
    parser.add_argument('--token', required=True, help='JWT token')
    parser.add_argument('--server', default='http://localhost:5000', help='Server URL')
    
    args = parser.parse_args()
    
    pickup = {'lat': args.pickup_lat, 'lng': args.pickup_lng}
    dropoff = {'lat': args.dropoff_lat, 'lng': args.dropoff_lng}
    
    simulate_driver(args.ride_id, pickup, dropoff, args.token, args.server)
