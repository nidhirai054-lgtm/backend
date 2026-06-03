#!/usr/bin/env python3
"""
Quick Start Driver Simulator
Usage: python quick_sim.py <ride_id>
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    if len(sys.argv) < 2:
        print("❌ Usage: python quick_sim.py <ride_id>")
        print("\nExample:")
        print("  python quick_sim.py 6a06e12597b1bcb94a75a698")
        sys.exit(1)
    
    ride_id = sys.argv[1]
    
    print(f"\n🚗 Quick Driver Simulator")
    print(f"📋 Ride ID: {ride_id}\n")
    
    # Import after adding to path
    from app import create_app
    from app.models.ride import Ride
    from app.models.user import User
    from flask_jwt_extended import create_access_token
    from socketio import Client
    import time
    import math
    
    app = create_app()
    
    with app.app_context():
        # Get ride details
        ride = Ride.objects(id=ride_id).first()
        if not ride:
            print(f"❌ Ride {ride_id} not found")
            sys.exit(1)
        
        print(f"✅ Found ride:")
        print(f"   From: {ride.pickup.get('address', 'Unknown')}")
        print(f"   To: {ride.dropoff.get('address', 'Unknown')}")
        print(f"   Status: {ride.status}\n")
        
        # Get driver token
        driver = User.objects(role='driver').first()
        if not driver:
            print("❌ No driver user found")
            sys.exit(1)
        
        token = create_access_token(identity=str(driver.id))
        print(f"✅ Using driver: {driver.name}\n")
        
        # Get coordinates
        pickup = {'lat': ride.pickup['lat'], 'lng': ride.pickup['lng']}
        dropoff = {'lat': ride.dropoff['lat'], 'lng': ride.dropoff['lng']}
        
        # Start simulation
        print("🎬 Starting simulation...\n")
        
        sio = Client()
        
        @sio.event
        def connect():
            print("✅ Connected to server")
        
        @sio.event
        def disconnect():
            print("❌ Disconnected")
        
        try:
            sio.connect('http://localhost:5000', auth={'token': token})
            time.sleep(1)
            
            # Phase 1: Arriving at pickup
            print("🔵 Phase 1: Driving to pickup...")
            start_pos = {'lat': pickup['lat'] - 0.01, 'lng': pickup['lng'] - 0.01}
            
            for i in range(11):  # 10 steps
                progress = i / 10
                lat = start_pos['lat'] + (pickup['lat'] - start_pos['lat']) * progress
                lng = start_pos['lng'] + (pickup['lng'] - start_pos['lng']) * progress
                
                sio.emit('update_driver_location', {
                    'ride_id': ride_id,
                    'lat': lat,
                    'lng': lng,
                    'heading': 45
                })
                
                print(f"  📍 {i*10}% to pickup")
                time.sleep(2)
            
            sio.emit('update_ride_status', {
                'ride_id': ride_id,
                'status': 'driver_arriving'
            })
            print("✅ Arrived at pickup!\n")
            time.sleep(2)
            
            # Phase 2: Trip to dropoff
            sio.emit('update_ride_status', {
                'ride_id': ride_id,
                'status': 'in_progress'
            })
            print("🟢 Phase 2: Trip in progress...")
            
            for i in range(11):  # 10 steps
                progress = i / 10
                lat = pickup['lat'] + (dropoff['lat'] - pickup['lat']) * progress
                lng = pickup['lng'] + (dropoff['lng'] - pickup['lng']) * progress
                
                sio.emit('update_driver_location', {
                    'ride_id': ride_id,
                    'lat': lat,
                    'lng': lng,
                    'heading': 90
                })
                
                print(f"  📍 {i*10}% to dropoff")
                time.sleep(2)
            
            sio.emit('update_ride_status', {
                'ride_id': ride_id,
                'status': 'completed'
            })
            print("\n🏁 Trip completed!")
            
            time.sleep(1)
            sio.disconnect()
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    main()
