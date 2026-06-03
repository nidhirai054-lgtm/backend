# Quick Start Guide - Real-Time Ride Tracking

## Step 1: Start Backend
```bash
cd backend
source venv/bin/activate
python run.py
```

## Step 2: Start Frontend
```bash
cd frontend
npm start
```

## Step 3: Book a Ride
1. Open browser: http://localhost:3000
2. Login: `nidhi@google.com` / `pass123`
3. Click quick preset: **Koramangala** (pickup)
4. Click quick preset: **Whitefield** (dropoff)
5. Click **Book Ride** button
6. Watch the search modal appear
7. After booking, the tracking modal opens
8. **Copy the Ride ID** from browser console (look for "Booking response")

## Step 4: Simulate Driver Movement
In a new terminal:
```bash
cd backend
source venv/bin/activate
python quick_sim.py <RIDE_ID>
```

Example:
```bash
python quick_sim.py 6a06e12597b1bcb94a75a698
```

## What You'll See

**In Terminal:**
- Driver connecting to server
- Phase 1: Driving to pickup (10 steps, 20 seconds)
- Phase 2: Trip in progress (10 steps, 20 seconds)
- Trip completed

**In Browser:**
- Car emoji moving smoothly on map
- Car rotating based on direction
- ETA counting down in real-time
- Status changing: driver_arriving → in_progress → completed
- Route line showing path

## Troubleshooting

**"Ride not found"**
- Make sure you copied the correct ride ID
- Check browser console for the ride ID after booking

**"No driver user found"**
- Run: `cd backend && source venv/bin/activate && python check_users.py`
- Should show driver: rajesh@google.com

**Backend not running**
- Check if port 5000 is free: `lsof -i :5000`
- Kill existing process: `kill -9 <PID>`

**Frontend not connecting**
- Check if backend is running on http://localhost:5000
- Check browser console for errors
- Verify JWT token in localStorage

## Features Implemented

✅ Real-time driver location updates via Socket.IO
✅ Smooth 60 FPS car animation with interpolation
✅ Car rotation based on direction of travel
✅ Driver search modal with animated UI
✅ Multiple ride states with transitions
✅ Real-time ETA calculation
✅ OSRM routing for actual road paths
✅ Status timeline showing trip progress

## Quick Commands

**Get latest ride ID:**
```bash
cd backend && source venv/bin/activate
python -c "from app import create_app; from app.models.ride import Ride; app = create_app(); app.app_context().push(); ride = Ride.objects().order_by('-created_at').first(); print(f'Latest Ride ID: {ride.id}')"
```

**Check ride status:**
```bash
python -c "from app import create_app; from app.models.ride import Ride; app = create_app(); app.app_context().push(); ride = Ride.objects(id='<RIDE_ID>').first(); print(f'Status: {ride.status}')"
```
