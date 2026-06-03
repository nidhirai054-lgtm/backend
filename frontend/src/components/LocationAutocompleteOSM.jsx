import React, { useState, useEffect, useRef } from 'react';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationCrosshairs, faSpinner, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';

const provider = new OpenStreetMapProvider();

const LocationAutocompleteOSM = ({ 
  placeholder, 
  onSelect, 
  value,
  showCurrentLocation = true,
  disabled = false 
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (value) {
      setInputValue(value);
    }
  }, [value]);

  const handleInputChange = async (e) => {
    const query = e.target.value;
    setInputValue(query);

    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce search
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await provider.search({ query: query + ', Bangalore, Karnataka, India' });
        setSuggestions(results.slice(0, 8));
        setShowSuggestions(true);
      } catch (error) {
        console.error('Search failed:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = (result) => {
    const locationData = {
      lat: result.y,
      lng: result.x,
      address: result.label,
      place_id: result.raw.place_id
    };
    
    setInputValue(result.label);
    setSuggestions([]);
    setShowSuggestions(false);
    onSelect(locationData);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          const results = await provider.search({ 
            query: `${latitude},${longitude}` 
          });

          if (results[0]) {
            const locationData = {
              lat: latitude,
              lng: longitude,
              address: results[0].label,
              place_id: results[0].raw.place_id
            };
            
            setInputValue(locationData.address);
            onSelect(locationData);
          }
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
          // Fallback: use coordinates directly
          const locationData = {
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            place_id: null
          };
          setInputValue(locationData.address);
          onSelect(locationData);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = 'Unable to get location. ';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Enable location in browser settings (Safari: Settings > Privacy > Location Services).';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'Try moving to an area with better GPS signal.';
            break;
          case error.TIMEOUT:
            errorMsg += 'GPS timeout. Try again or enter address manually.';
            break;
          default:
            errorMsg += 'Please enter address manually.';
        }
        
        alert(errorMsg);
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    );
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled || loading}
          className="w-full pl-4 pr-24 py-3.5 bg-white border-2 border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all placeholder-gray-400 disabled:opacity-50 disabled:bg-gray-50"
          autoComplete="off"
        />
        
        {loading && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-400" />
          </div>
        )}
        
        {showCurrentLocation && (
          <button
            type="button"
            onClick={handleCurrentLocation}
            disabled={loading || disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50 font-bold text-xs"
            title="Use current location"
          >
            <FontAwesomeIcon icon={faLocationCrosshairs} className="mr-1" />
            GPS
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <>
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl z-[9999] max-h-80 overflow-y-auto">
            {suggestions.map((result, index) => {
              const parts = result.label.split(',');
              const mainText = parts[0];
              const subText = parts.slice(1).join(',');
              
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectSuggestion(result)}
                  className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-start gap-3 group"
                >
                  <FontAwesomeIcon 
                    icon={faMapMarkerAlt} 
                    className="text-emerald-500 mt-1 group-hover:scale-110 transition-transform" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{mainText}</p>
                    <p className="text-xs text-gray-500 truncate">{subText}</p>
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setShowSuggestions(false)}
          />
        </>
      )}
      
      {/* No results message */}
      {showSuggestions && suggestions.length === 0 && !loading && inputValue.length >= 3 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl z-[9999] p-4 text-center">
          <p className="text-sm text-gray-500">No locations found. Try a different search.</p>
        </div>
      )}
    </div>
  );
};

export default LocationAutocompleteOSM;
