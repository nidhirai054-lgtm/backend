import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import useSocket from '../hooks/useSocket';
import { getRoute } from '../services/routing';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCar, faUser, faStar, faPhone, faMessage, 
  faXmark, faLocationDot, faFlag, faClock 
} from '@fortawesome/free-solid-svg-icons';

const carIcon = (rotation = 0) => L.divIcon({
  className: 'custom-car-icon',
  html: `<div style="font-size:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));transform:rotate(${rotation}deg);transition:transform 0.3s ease;">🚗</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const pickupIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color:#10b981;width:32px;height:32px;border-radius:50%;border:4px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">A</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const dropoffIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color:#ef4444;width:32px;height:32px;border-radius:50%;border:4px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">B</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const FitBounds = ({ pickup, dropoff, driverLocation }) => {
  const map = useMap();
  
  useEffect(() => {
    const bounds = L.latLngBounds();
    if (pickup) bounds.extend([pickup.lat, pickup.lng]);
    if (dropoff) bounds.extend([dropoff.lat, dropoff.lng]);
    if (driverLocation) bounds.extend([driverLocation.lat, driverLocation.lng]);
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [80, 80] });
    }
  }, [pickup, dropoff, driverLocation, map]);
  
  return null;
};

const ActiveRideTracking = ({ ride, driver, onClose }) => {
  const { on, off, emit } = useSocket();
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(ride.estimated_duration_minutes || 15);
  const [rideStatus, setRideStatus] = useState(ride.status);
  const [carRotation, setCarRotation] = useState(0);
  const [routePath, setRoutePath] = useState([]);
  
  // For smooth interpolation
  const animationFrameRef = useRef(null);
  const targetLocationRef = useRef(null);
  const currentLocationRef = useRef(null);
  const interpolationProgressRef = useRef(0);

  // Calculate bearing between two points
  const calculateBearing = (start, end) => {
    const dLng = end.lng - start.lng;
    const dLat = end.lat - start.lat;
    return Math.atan2(dLng, dLat) * (180 / Math.PI);
  };

  // Smooth interpolation between positions
  const interpolatePosition = (start, end, progress) => {
    return {
      lat: start.lat + (end.lat - start.lat) * progress,
      lng: start.lng + (end.lng - start.lng) * progress
    };
  };

  // Animate car movement smoothly
  const animateCarMovement = () => {
    if (!currentLocationRef.current || !targetLocationRef.current) return;

    interpolationProgressRef.current += 0.02; // Increment by 2% each frame

    if (interpolationProgressRef.current >= 1) {
      // Reached target
      currentLocationRef.current = targetLocationRef.current;
      setDriverLocation(targetLocationRef.current);
      interpolationProgressRef.current = 0;
      return;
    }

    // Interpolate position
    const newPos = interpolatePosition(
      currentLocationRef.current,
      targetLocationRef.current,
      interpolationProgressRef.current
    );

    setDriverLocation(newPos);
    animationFrameRef.current = requestAnimationFrame(animateCarMovement);
  };

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!ride?.id) return;

    // Join passenger room
    emit('join_passenger_room', { user_id: ride.passenger_id });

    // Listen for driver location updates
    const handleLocationUpdate = (data) => {
      if (data.ride_id !== ride.id) return;

      const newLocation = {
        lat: data.driver_location.lat,
        lng: data.driver_location.lng
      };

      // Set target for smooth animation
      targetLocationRef.current = newLocation;

      // Initialize current location if first update
      if (!currentLocationRef.current) {
        currentLocationRef.current = newLocation;
        setDriverLocation(newLocation);
      } else {
        // Calculate rotation
        const bearing = calculateBearing(currentLocationRef.current, newLocation);
        setCarRotation(bearing);

        // Start smooth animation
        interpolationProgressRef.current = 0;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(animateCarMovement);
      }

      // Update ETA
      if (data.eta_minutes) {
        setEta(data.eta_minutes);
      }

      // Update status
      if (data.status) {
        setRideStatus(data.status);
      }
    };

    // Listen for status changes
    const handleStatusChange = (data) => {
      if (data.ride_id !== ride.id) return;
      setRideStatus(data.status);

      if (data.status === 'completed') {
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    };

    on('ride_location_update', handleLocationUpdate);
    on('ride_status_changed', handleStatusChange);

    return () => {
      off('ride_location_update');
      off('ride_status_changed');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [ride, on, off, emit, onClose]);

  // Fetch route path using OSRM
  useEffect(() => {
    if (!ride.pickup || !ride.dropoff) return;

    getRoute(ride.pickup, ride.dropoff)
      .then(route => {
        if (route.coordinates && route.coordinates.length > 0) {
          setRoutePath(route.coordinates);
        }
      })
      .catch(err => {
        console.error('Failed to fetch route:', err);
        // Fallback to straight line
        setRoutePath([
          { lat: ride.pickup.lat, lng: ride.pickup.lng },
          { lat: ride.dropoff.lat, lng: ride.dropoff.lng }
        ]);
      });
  }, [ride.pickup, ride.dropoff]);

  // Initial driver location (fallback simulation if no socket updates)
  useEffect(() => {
    if (!ride.pickup || !ride.dropoff) return;
    if (driverLocation) return; // Don't simulate if we have real location

    // Start driver at pickup location or slightly before
    const initialLocation = ride.driver_current_location || {
      lat: ride.pickup.lat - 0.005,
      lng: ride.pickup.lng - 0.005
    };

    setDriverLocation(initialLocation);
    currentLocationRef.current = initialLocation;
  }, [ride, driverLocation]);

  const statusSteps = [
    { label: 'Searching', status: 'searching', icon: faClock },
    { label: 'Driver Assigned', status: 'driver_assigned', icon: faCar },
    { label: 'Arriving', status: 'driver_arriving', icon: faLocationDot },
    { label: 'In Progress', status: 'in_progress', icon: faFlag }
  ];

  const getStepIndex = (status) => {
    const index = statusSteps.findIndex(s => s.status === status);
    return index >= 0 ? index : 0;
  };

  const currentStep = getStepIndex(rideStatus);

  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center animate-fade-in">
      <div className="bg-white w-full md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-slide-up md:animate-scale-in max-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all"
          >
            <FontAwesomeIcon icon={faXmark} className="text-xl" />
          </button>
          
          <h2 className="text-2xl font-black mb-2">Your Ride</h2>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              rideStatus === 'in_progress' ? 'bg-green-400 animate-pulse' : 
              rideStatus === 'driver_arriving' ? 'bg-blue-400 animate-pulse' :
              rideStatus === 'driver_assigned' ? 'bg-yellow-400' : 'bg-gray-400'
            }`}></div>
            <span className="text-sm font-bold opacity-90 capitalize">{rideStatus.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-0 md:gap-4 h-full">
            {/* Left: Map */}
            <div className="h-80 md:h-auto relative">
              <MapContainer
                center={[ride.pickup.lat, ride.pickup.lng]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Pickup */}
                <Marker position={[ride.pickup.lat, ride.pickup.lng]} icon={pickupIcon}>
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold text-emerald-600">Pickup</p>
                      <p>{ride.pickup.address}</p>
                    </div>
                  </Popup>
                </Marker>
                
                {/* Dropoff */}
                <Marker position={[ride.dropoff.lat, ride.dropoff.lng]} icon={dropoffIcon}>
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold text-red-600">Dropoff</p>
                      <p>{ride.dropoff.address}</p>
                    </div>
                  </Popup>
                </Marker>
                
                {/* Driver car */}
                {driverLocation && (
                  <Marker position={[driverLocation.lat, driverLocation.lng]} icon={carIcon(carRotation)}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-bold">Driver Location</p>
                        <p>{driver?.name || 'Your driver'}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                
                {/* Route line - use OSRM path if available */}
                {routePath.length > 0 ? (
                  <Polyline
                    positions={routePath.map(p => [p.lat, p.lng])}
                    color="#10b981"
                    weight={4}
                    opacity={0.7}
                  />
                ) : (
                  <Polyline
                    positions={[
                      [ride.pickup.lat, ride.pickup.lng],
                      [ride.dropoff.lat, ride.dropoff.lng]
                    ]}
                    color="#10b981"
                    weight={4}
                    opacity={0.6}
                    dashArray="10, 10"
                  />
                )}
                
                <FitBounds 
                  pickup={ride.pickup} 
                  dropoff={ride.dropoff} 
                  driverLocation={driverLocation}
                />
              </MapContainer>
              
              {/* ETA Badge */}
              <div className="absolute top-4 left-4 bg-white rounded-2xl shadow-lg px-4 py-3 z-[1000]">
                <p className="text-xs text-gray-500 font-bold uppercase">ETA</p>
                <p className="text-2xl font-black text-emerald-600">{Math.ceil(eta)} min</p>
                {rideStatus === 'completed' && (
                  <p className="text-xs text-green-600 font-bold mt-1">✓ Arrived</p>
                )}
              </div>
            </div>

            {/* Right: Details */}
            <div className="p-6 space-y-6">
              {/* Driver Info */}
              {driver && (
                <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-2xl font-black">
                    {driver.name[0]}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-lg text-gray-900">{driver.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FontAwesomeIcon icon={faStar} className="text-yellow-500" />
                      <span className="font-bold">{driver.avg_rating?.toFixed(1) || '5.0'}</span>
                      <span className="text-gray-400">•</span>
                      <span>{driver.vehicle_type || 'Sedan'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="w-10 h-10 bg-emerald-100 hover:bg-emerald-200 rounded-full flex items-center justify-center transition-all">
                      <FontAwesomeIcon icon={faPhone} className="text-emerald-600" />
                    </button>
                    <button className="w-10 h-10 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center transition-all">
                      <FontAwesomeIcon icon={faMessage} className="text-blue-600" />
                    </button>
                  </div>
                </div>
              )}

              {/* Trip Details */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <div className="w-0.5 h-12 bg-gray-200"></div>
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase mb-1">Pickup</p>
                      <p className="text-sm font-semibold text-gray-900">{ride.pickup.address}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase mb-1">Dropoff</p>
                      <p className="text-sm font-semibold text-gray-900">{ride.dropoff.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fare & Details */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-4 border-2 border-emerald-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-gray-700">Total Fare</span>
                  <span className="text-3xl font-black text-emerald-600">₹{ride.fare}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-emerald-200">
                  <div>
                    <p className="text-xs text-emerald-700 font-bold mb-1">Distance</p>
                    <p className="text-sm font-black text-gray-800">{ride.distance_km?.toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700 font-bold mb-1">Type</p>
                    <p className="text-sm font-black text-gray-800 capitalize">{ride.ride_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700 font-bold mb-1">CO₂ Saved</p>
                    <p className="text-sm font-black text-gray-800">{ride.co2_saved?.toFixed(1)} kg</p>
                  </div>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase">Trip Status</p>
                <div className="space-y-2">
                  {statusSteps.map((step, index) => (
                    <div 
                      key={step.label}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                        index <= currentStep ? 'bg-emerald-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index <= currentStep ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-500'
                      }`}>
                        <FontAwesomeIcon icon={step.icon} className="text-sm" />
                      </div>
                      <span className={`text-sm font-bold ${
                        index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveRideTracking;
