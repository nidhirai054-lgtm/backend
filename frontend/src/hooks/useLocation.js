import React, { useState, useEffect } from 'react';

const useLocation = () => {
  const [location, setLocation] = useState({
    lat: 13.05, // Default Kempapura
    lng: 77.59,
    accuracy: null,
    error: null,
    loading: true
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, error: "Geolocation not supported", loading: false }));
      return;
    }

    const handleSuccess = (position) => {
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        error: null,
        loading: false
      });
    };

    const handleError = (error) => {
      setLocation(prev => ({ ...prev, error: error.message, loading: false }));
    };

    const watcher = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    });

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return location;
};

export default useLocation;
