import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MapView from '../components/MapView';
import LocationAutocompleteOSM from '../components/LocationAutocompleteOSM';
import ActiveRideTracking from '../components/ActiveRideTracking';
import DriverSearchModal from '../components/DriverSearchModal';
import VoiceButton from '../components/VoiceButton';
import useLocation from '../hooks/useLocation';
import useSocket from '../hooks/useSocket';
import api from '../api/axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCarSide, faBus, faBolt, faLeaf, faUsers, faShieldHalved,
  faLocationDot, faMapPin, faRightFromBracket, faCircleCheck,
  faCircleXmark, faXmark, faSpinner,
  faCar, faRoute,
} from '@fortawesome/free-solid-svg-icons';

const RIDE_TYPES = [
  { key: 'solo',   icon: faCarSide, label: 'Solo',   desc: 'Just you' },
  { key: 'pooled', icon: faBus,     label: 'Pooled', desc: 'Share & save' },
  { key: 'EV',     icon: faBolt,    label: 'EV',     desc: 'Zero emission' },
];

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in-up
    ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
    <FontAwesomeIcon icon={type === 'success' ? faCircleCheck : faCircleXmark} className="text-lg" />
    <span className="font-semibold text-sm">{msg}</span>
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
      <FontAwesomeIcon icon={faXmark} />
    </button>
  </div>
);

const statusColor = { 
  searching: '#9ca3af', 
  driver_assigned: '#f59e0b', 
  driver_arriving: '#3b82f6',
  in_progress: '#10b981', 
  completed: '#0ea5e9', 
  cancelled: '#ef4444' 
};

const Home = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { isConnected, on, off } = useSocket();
  const [drivers, setDrivers] = useState([]);
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [booking, setBooking] = useState({ rideType: 'solo', womenOnly: false });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [recentRides, setRecentRides] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [activeDriver, setActiveDriver] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    api.get('/rides/').then(r => setRecentRides(r.data.slice(0, 3))).catch(() => {});
  }, []);

  useEffect(() => {
    const handleDrivers = (data) => setDrivers(data);
    on('nearby_drivers', handleDrivers);
    return () => off('nearby_drivers');
  }, [on, off]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePickupSelect = async (locationData) => {
    setPickup(locationData);
    
    // If dropoff already selected, get estimate
    if (dropoff) {
      try {
        const res = await api.post('/rides/estimate', {
          pickup: locationData,
          dropoff,
          ride_type: booking.rideType
        });
        setEstimate(res.data);
      } catch (err) {
        console.error('Estimate failed:', err);
      }
    }
  };

  const handleDropoffSelect = async (locationData) => {
    setDropoff(locationData);
    
    // If pickup already selected, get estimate
    if (pickup) {
      try {
        const res = await api.post('/rides/estimate', {
          pickup,
          dropoff: locationData,
          ride_type: booking.rideType
        });
        setEstimate(res.data);
      } catch (err) {
        console.error('Estimate failed:', err);
      }
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!pickup || !dropoff) {
      showToast('Please select pickup and dropoff locations', 'error');
      return;
    }
    
    console.log('📍 Booking ride:', { pickup, dropoff, ride_type: booking.rideType });
    
    // Show search modal
    setShowSearchModal(true);
    
    try {
      const res = await api.post('/rides/book', {
        pickup,
        dropoff,
        ride_type: booking.rideType,
        women_only: booking.womenOnly,
      });
      
      console.log('✅ Booking response:', res.data);
      
      // Close search modal
      setShowSearchModal(false);
      
      setRecentRides(prev => [res.data.ride, ...prev].slice(0, 3));
      
      // Check if driver was assigned
      if (res.data.ride.status === 'driver_assigned' && res.data.driver) {
        showToast(`Driver found! ${res.data.driver.name} is on the way`);
      } else {
        showToast('Ride booked! Searching for driver...');
      }
      
      // Show active ride tracking
      setActiveRide(res.data.ride);
      setActiveDriver(res.data.driver);
      
      setPickup(null);
      setDropoff(null);
      setEstimate(null);
      
      // Refresh rides list
      api.get('/rides/').then(r => setRecentRides(r.data.slice(0, 3))).catch(() => {});
    } catch (err) {
      console.error('❌ Booking error:', err);
      setShowSearchModal(false);
      showToast(err.response?.data?.error || 'Booking failed', 'error');
    }
  };

  // Driver View
  if (user?.role === 'driver') {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}

        {/* Navbar */}
        <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 gradient-green rounded-xl flex items-center justify-center shadow-md">
              <FontAwesomeIcon icon={faCarSide} className="text-white text-sm" />
            </div>
            <span className="text-xl font-black text-gray-900 tracking-tight">SmartRide Driver</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
              <div className="w-6 h-6 gradient-green rounded-full flex items-center justify-center text-white text-xs font-black">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-bold text-gray-800 hidden sm:block">{user?.name}</span>
              <span className="text-[10px] font-bold text-blue-500 uppercase">Driver</span>
            </div>
            <button onClick={logout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Logout">
              <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
            </button>
          </div>
        </nav>

        <main className="flex-grow flex flex-col md:flex-row" style={{ height: 'calc(100vh - 61px)' }}>
          {/* Driver Sidebar */}
          <div className="w-full md:w-[380px] bg-white border-r border-gray-100 flex flex-col overflow-y-auto shadow-xl z-20">
            <div className="p-6">
              <h2 className="text-2xl font-black text-gray-900">Your Rides</h2>
              <p className="text-sm text-gray-400 mt-0.5">Active and recent trips</p>
            </div>

            {/* Recent rides */}
            <div className="px-6 pb-4 flex-grow">
              {recentRides.length === 0 ? (
                <div className="text-center py-12">
                  <FontAwesomeIcon icon={faCarSide} className="text-gray-300 text-4xl mb-3" />
                  <p className="text-gray-400 text-sm">No rides yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRides.map((r, i) => (
                    <div key={r.id || i} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${statusColor[r.status]}20`, color: statusColor[r.status] }}>
                          {r.status}
                        </span>
                        <span className="text-xs font-bold text-gray-500">₹{r.fare}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {r.pickup?.address || 'Pickup'} → {r.dropoff?.address || 'Dropoff'}
                      </p>
                      <p className="text-[10px] text-gray-400">{r.distance_km?.toFixed(1)} km · {r.ride_type}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Driver Stats */}
            <div className="px-6 pb-6 mt-auto">
              <div className="gradient-green rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full"></div>
                <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-1">Rating</p>
                <p className="text-3xl font-black">{user?.avg_rating?.toFixed(1) || '5.0'} ⭐</p>
                <p className="text-xs opacity-80 mt-1">Keep up the great work!</p>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-grow relative overflow-hidden bg-gray-200">
            <MapView userLocation={location} drivers={[]} />
            <div className="absolute top-4 right-4 glass px-3 py-1.5 rounded-full shadow flex items-center gap-2 z-[1000]">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></div>
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-tight">{isConnected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Passenger View (default)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      {/* Driver Search Modal */}
      {showSearchModal && pickup && (
        <DriverSearchModal
          pickup={pickup}
          onCancel={() => setShowSearchModal(false)}
          onDriverFound={(driver) => {
            setShowSearchModal(false);
            setActiveDriver(driver);
          }}
          estimatedWaitTime={30}
        />
      )}
      
      {/* Active Ride Tracking Modal */}
      {activeRide && (
        <ActiveRideTracking
          ride={activeRide}
          driver={activeDriver}
          onClose={() => {
            setActiveRide(null);
            setActiveDriver(null);
          }}
        />
      )}

      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 gradient-green rounded-xl flex items-center justify-center shadow-md">
            <FontAwesomeIcon icon={faCarSide} className="text-white text-sm" />
          </div>
          <span className="text-xl font-black text-gray-900 tracking-tight">SmartRide</span>
        </div>

        <div className="hidden sm:flex items-center gap-1">
          {[
            { to: '/my-rides',    label: 'My Rides',     icon: faCar },
            { to: '/community',   label: 'Community',    icon: faUsers },
            { to: '/green-rides', label: 'Green Impact', icon: faLeaf },
          ].map(({ to, label, icon }) => (
            <Link key={to} to={to}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all">
              <FontAwesomeIcon icon={icon} className="text-xs" />
              {label}
            </Link>
          ))}
          {user?.role === 'admin' && (
            <Link to="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all">
              <FontAwesomeIcon icon={faShieldHalved} className="text-xs" />
              Safety
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
            <div className="w-6 h-6 gradient-green rounded-full flex items-center justify-center text-white text-xs font-black">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-bold text-gray-800 hidden sm:block">{user?.name}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">{user?.role}</span>
          </div>
          <button onClick={logout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Logout">
            <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <main className="flex-grow flex flex-col md:flex-row" style={{ height: 'calc(100vh - 61px)' }}>
        {/* Sidebar */}
        <div className="w-full md:w-[380px] bg-white border-r border-gray-100 flex flex-col overflow-y-auto shadow-xl z-20">
          <div className="p-6 pb-2">
            <h2 className="text-2xl font-black text-gray-900 animate-fade-in-up">Where to?</h2>
            <p className="text-sm text-gray-400 mt-0.5 animate-fade-in-up stagger-1">Book a ride in seconds</p>
          </div>

          <form onSubmit={handleBook} className="p-6 space-y-4">
            {/* Pickup */}
            <div className="animate-fade-in-up stagger-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Pickup Location</p>
              <LocationAutocompleteOSM
                placeholder="Enter pickup location"
                onSelect={handlePickupSelect}
                value={pickup?.address}
                showCurrentLocation={true}
              />
              {/* Quick presets */}
              {!pickup && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
                    { name: 'Indiranagar', lat: 12.9716, lng: 77.6412 },
                    { name: 'MG Road', lat: 12.9716, lng: 77.5946 }
                  ].map(loc => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => handlePickupSelect({ ...loc, address: loc.name + ', Bangalore' })}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-emerald-100 text-gray-700 hover:text-emerald-700 rounded-full font-bold transition-all"
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dropoff */}
            <div className="animate-fade-in-up stagger-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Dropoff Location</p>
              <LocationAutocompleteOSM
                placeholder="Enter dropoff location"
                onSelect={handleDropoffSelect}
                value={dropoff?.address}
                showCurrentLocation={false}
              />
              {/* Quick presets */}
              {!dropoff && pickup && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    { name: 'Whitefield', lat: 12.9698, lng: 77.7500 },
                    { name: 'Electronic City', lat: 12.8456, lng: 77.6603 },
                    { name: 'Airport', lat: 13.1986, lng: 77.7066 }
                  ].map(loc => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => handleDropoffSelect({ ...loc, address: loc.name + ', Bangalore' })}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-sky-100 text-gray-700 hover:text-sky-700 rounded-full font-bold transition-all"
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Estimate display */}
            {estimate && (
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-2xl p-5 animate-fade-in shadow-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Estimated Fare</p>
                    <p className="text-4xl font-black text-emerald-600">₹{estimate.fare.total}</p>
                  </div>
                  {estimate.fare.surge_multiplier > 1 && (
                    <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-black">
                      ⚡ {estimate.fare.surge_multiplier}x
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-emerald-200">
                  <div>
                    <p className="text-xs text-emerald-600 font-bold mb-1">Distance</p>
                    <p className="text-sm font-black text-gray-800">{estimate.route.distance_text}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-bold mb-1">Duration</p>
                    <p className="text-sm font-black text-gray-800">{estimate.route.duration_text}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Ride type */}
            <div className="animate-fade-in-up stagger-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Ride Type</p>
              <div className="grid grid-cols-3 gap-2">
                {RIDE_TYPES.map(({ key, icon, label, desc }) => (
                  <button key={key} type="button"
                    onClick={() => setBooking(b => ({ ...b, rideType: key }))}
                    className={`py-3 px-2 rounded-2xl border-2 text-center transition-all duration-200 ${
                      booking.rideType === key
                        ? 'border-emerald-500 bg-emerald-50 scale-105 shadow-md'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}>
                    <FontAwesomeIcon icon={icon} className={`text-lg mb-1 ${booking.rideType === key ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <div className={`text-xs font-black uppercase ${booking.rideType === key ? 'text-emerald-700' : 'text-gray-500'}`}>{label}</div>
                    <div className="text-[9px] text-gray-400">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Women only */}
            <div className="flex items-center justify-between px-1 animate-fade-in-up stagger-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">Women-only ride</p>
                <p className="text-[10px] text-gray-400">Female drivers only</p>
              </div>
              <button type="button"
                onClick={() => setBooking(b => ({ ...b, womenOnly: !b.womenOnly }))}
                className={`w-12 h-6 rounded-full transition-all duration-300 relative shadow-inner ${booking.womenOnly ? 'bg-pink-500' : 'bg-gray-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${booking.womenOnly ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>

            <button type="submit" disabled={loading || !pickup || !dropoff || showSearchModal}
              className="w-full gradient-green text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl hover:opacity-95 transition-all active:scale-95 animate-fade-in-up stagger-5 disabled:opacity-60 flex items-center justify-center gap-2">
              {showSearchModal
                ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Searching...</>
                : <><FontAwesomeIcon icon={faRoute} /> Book Ride</>}
            </button>
          </form>

          {/* Voice - Removed for now since it needs text input */}

          {/* Recent rides */}
          {recentRides.length > 0 && (
            <div className="px-6 pb-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Recent Rides</p>
              <div className="space-y-2">
                {recentRides.map((r, i) => (
                  <button
                    key={r.id || i}
                    onClick={() => {
                      if (r.status === 'in_progress' || r.status === 'driver_arriving' || r.status === 'driver_assigned') {
                        setActiveRide(r);
                        setActiveDriver(r.driver_id ? { name: 'Driver', avg_rating: 4.8 } : null);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all animate-fade-in-up cursor-pointer"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor[r.status] || '#ccc' }}></div>
                    <div className="flex-grow min-w-0 text-left">
                      <p className="text-xs font-semibold text-gray-700 truncate">{r.pickup?.address || 'Pickup'} → {r.dropoff?.address || 'Dropoff'}</p>
                      <p className="text-[10px] text-gray-400">₹{r.fare} · {r.distance_km?.toFixed(1)} km</p>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${statusColor[r.status]}20`, color: statusColor[r.status] }}>{r.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Green points */}
          <div className="px-6 pb-6 mt-auto">
            <div className="gradient-green rounded-2xl p-4 text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full"></div>
              <div className="absolute -right-2 -bottom-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="flex items-center gap-2 mb-1">
                <FontAwesomeIcon icon={faLeaf} className="opacity-80" />
                <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Green Points</p>
              </div>
              <p className="text-3xl font-black">{user?.green_points || 0}</p>
              <Link to="/green-rides" className="text-[10px] font-bold opacity-80 hover:opacity-100 underline">View impact</Link>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-grow relative overflow-hidden bg-gray-200">
          <MapView
            pickup={pickup}
            dropoff={dropoff}
            userLocation={location}
            drivers={drivers}
          />
          <div className="absolute top-4 right-4 glass px-3 py-1.5 rounded-full shadow flex items-center gap-2 z-[1000]">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></div>
            <span className="text-[10px] font-black text-gray-600 uppercase tracking-tight">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
          {drivers.length > 0 && (
            <div className="absolute bottom-4 left-4 glass px-4 py-2 rounded-2xl shadow z-[1000] flex items-center gap-2">
              <FontAwesomeIcon icon={faCarSide} className="text-emerald-600 text-sm" />
              <p className="text-xs font-black text-gray-700">{drivers.length} drivers nearby</p>
            </div>
          )}
        </div>
      </main>

    </div>
  );
};

export default Home;
