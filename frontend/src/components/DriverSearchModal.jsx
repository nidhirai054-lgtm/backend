import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSpinner, faSearch, faCar, faXmark, faMapMarkerAlt 
} from '@fortawesome/free-solid-svg-icons';

const AnimatedSearchRadius = ({ center, radius }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], 13);
    }
  }, [center, map]);
  
  return (
    <>
      {/* Expanding circles animation */}
      <Circle
        center={[center.lat, center.lng]}
        radius={radius * 333}
        pathOptions={{
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.1,
          weight: 2,
          className: 'animate-pulse'
        }}
      />
      <Circle
        center={[center.lat, center.lng]}
        radius={radius * 666}
        pathOptions={{
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.05,
          weight: 1,
          className: 'animate-pulse'
        }}
        style={{ animationDelay: '0.5s' }}
      />
    </>
  );
};

const DriverSearchModal = ({ 
  pickup, 
  onCancel, 
  onDriverFound,
  estimatedWaitTime = 30 
}) => {
  const [searchRadius, setSearchRadius] = useState(1);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [driversNearby, setDriversNearby] = useState(0);
  const [searchPhase, setSearchPhase] = useState('searching'); // searching, found, timeout

  useEffect(() => {
    // Simulate expanding search radius
    const radiusInterval = setInterval(() => {
      setSearchRadius(prev => {
        if (prev >= 10) return 10;
        return prev + 0.5;
      });
    }, 1000);

    // Timer
    const timerInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    // Simulate finding drivers (random for demo)
    const driversInterval = setInterval(() => {
      setDriversNearby(Math.floor(Math.random() * 5) + 1);
    }, 2000);

    // Timeout after estimatedWaitTime
    const timeout = setTimeout(() => {
      setSearchPhase('timeout');
    }, estimatedWaitTime * 1000);

    return () => {
      clearInterval(radiusInterval);
      clearInterval(timerInterval);
      clearInterval(driversInterval);
      clearTimeout(timeout);
    };
  }, [estimatedWaitTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (searchPhase === 'timeout') {
    return (
      <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md mx-4 animate-scale-in">
          <div className="text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon icon={faCar} className="text-4xl text-orange-500" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">No Drivers Available</h3>
            <p className="text-gray-600 mb-6">
              We couldn't find any drivers nearby right now. Please try again in a few minutes.
            </p>
            <button
              onClick={onCancel}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-2xl w-full mx-4 animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white relative">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <FontAwesomeIcon icon={faSearch} className="text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl font-black">Finding Your Driver</h2>
              <p className="text-sm opacity-90">Searching nearby drivers...</p>
            </div>
          </div>
        </div>

        {/* Map with expanding search radius */}
        <div className="h-80 relative">
          <MapContainer
            center={[pickup.lat, pickup.lng]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
            zoomControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <AnimatedSearchRadius center={pickup} radius={searchRadius} />
          </MapContainer>

          {/* Pickup marker overlay */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
            <div className="relative">
              <FontAwesomeIcon 
                icon={faMapMarkerAlt} 
                className="text-5xl text-emerald-500 drop-shadow-lg animate-bounce" 
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/20 rounded-full blur-sm"></div>
            </div>
          </div>

          {/* Search radius indicator */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg">
            <p className="text-xs text-gray-600 font-bold uppercase">Search Radius</p>
            <p className="text-2xl font-black text-emerald-600">{searchRadius.toFixed(1)} km</p>
          </div>
        </div>

        {/* Status info */}
        <div className="p-6 space-y-4">
          {/* Searching animation */}
          <div className="flex items-center justify-center gap-3 py-4">
            <FontAwesomeIcon 
              icon={faSpinner} 
              className="text-3xl text-emerald-500 animate-spin" 
            />
            <div>
              <p className="text-lg font-bold text-gray-900">Searching for drivers...</p>
              <p className="text-sm text-gray-500">This usually takes a few seconds</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 rounded-xl p-4 text-center border-2 border-emerald-100">
              <p className="text-xs text-emerald-700 font-bold uppercase mb-1">Drivers Nearby</p>
              <p className="text-3xl font-black text-emerald-600">{driversNearby}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center border-2 border-blue-100">
              <p className="text-xs text-blue-700 font-bold uppercase mb-1">Search Time</p>
              <p className="text-3xl font-black text-blue-600">{formatTime(elapsedTime)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center border-2 border-purple-100">
              <p className="text-xs text-purple-700 font-bold uppercase mb-1">Max Wait</p>
              <p className="text-3xl font-black text-purple-600">{estimatedWaitTime}s</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-1000 ease-linear"
                style={{ width: `${(elapsedTime / estimatedWaitTime) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              {Math.max(0, estimatedWaitTime - elapsedTime)}s remaining
            </p>
          </div>

          {/* Cancel button */}
          <button
            onClick={onCancel}
            className="w-full border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition-all"
          >
            Cancel Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverSearchModal;
