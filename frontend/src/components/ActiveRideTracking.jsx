import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import useSocket from '../hooks/useSocket';
import api from '../api/axios';
import { getRoute } from '../services/routing';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCar, faUser, faStar, faPhone, faMessage, 
  faXmark, faLocationDot, faFlag, faClock,
  faTriangleExclamation, faBell, faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import PaymentModal from './PaymentModal';
import RatingModal from './RatingModal';
import { useAuth } from '../context/AuthContext';
import { rideEvents, RIDE_EVENTS } from '../utils/rideEvents';

const cleanPhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

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

const ActiveRideTracking = ({ ride, driver, socket, onClose }) => {
  const { user } = useAuth();
  const localSocket = useSocket();
  const { on, off, emit, joinRoom } = socket || localSocket;
  const [driverLocation, setDriverLocation] = useState(ride.driver_current_location || null);
  const [eta, setEta] = useState(ride.actual_eta_minutes || ride.estimated_duration_minutes || 15);
  const [rideStatus, setRideStatus] = useState(ride.status);
  const [carRotation, setCarRotation] = useState(0);
  const [routePath, setRoutePath] = useState([]);
  const [safetyAlert, setSafetyAlert] = useState(null);
  const [sosConfirmed, setSosConfirmed] = useState(null);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [sosOptions, setSosOptions] = useState({ contacts: true, police: true });
  const [activeDriver, setActiveDriver] = useState(driver);
  const [showPayment, setShowPayment] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [completedRide, setCompletedRide] = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [searchingTooLong, setSearchingTooLong] = useState(false);
  const [toast, setToast] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'driver', text: "Hello! I am heading towards your pickup location.", time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ]);
  const [cancelling, setCancelling] = useState(false);

  const handleSendMockMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = { sender: 'passenger', text: chatInput.trim(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setTimeout(() => {
      const driverReplies = [
        "I'm on my way!",
        "Stuck in a bit of traffic, will reach shortly.",
        "Almost there, please be ready at the pickup point.",
        "Understood, thank you!",
        "Yes, I am following the GPS route."
      ];
      const replyText = driverReplies[Math.floor(Math.random() * driverReplies.length)];
      setChatMessages(prev => [...prev, {
        sender: 'driver',
        text: replyText,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }]);
    }, 1500);
  };

  const handleCancelRide = async () => {
    setCancelling(true);
    try {
      await api.post(`/rides/cancel/${ride.id}`);
      setRideStatus('cancelled');
      rideEvents.emit(RIDE_EVENTS.RIDE_CANCELLED, { rideId: ride.id });
      setToast({ msg: 'Ride cancelled successfully.', type: 'success' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setToast({ msg: err.response?.data?.error || 'Failed to cancel ride.', type: 'error' });
    } finally {
      setCancelling(false);
    }
  };
  
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

  // Fetch latest status, driver profile, location, and alerts on mount
  useEffect(() => {
    if (!ride?.id) return;
    
    api.get(`/rides/${ride.id}/status`)
      .then(res => {
        const data = res.data;
        if (data.status) setRideStatus(data.status);
        if (data.eta_minutes) setEta(data.eta_minutes);
        if (data.driver_location && data.driver_location.lat && data.driver_location.lng) {
          const loc = { lat: data.driver_location.lat, lng: data.driver_location.lng };
          setDriverLocation(loc);
          currentLocationRef.current = loc;
        }
        if (data.driver) {
          setActiveDriver(data.driver);
        }
      })
      .catch(err => {
        console.error("Failed to fetch initial ride status", err);
      });
  }, [ride?.id]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!ride?.id) return;

    // Join passenger room AND ride-specific room for targeted broadcasts
    const pId = user?.id || ride.passenger_id;
    if (joinRoom) {
      joinRoom('passenger', pId);
      joinRoom('ride', ride.id);
    } else {
      emit('join_passenger_room', { user_id: pId });
    }

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
      rideEvents.emit(RIDE_EVENTS.RIDE_UPDATED, { ride: { ...ride, status: data.status } });

      if (data.status === 'completed') {
        // Save the completed ride data for post-ride flow
        setCompletedRide({ ...ride, status: 'completed', driver: activeDriver });
        // Trigger payment → then rating
        setTimeout(() => setShowPayment(true), 1200);
      }
    };

    // Safety alert from anomaly model
    const handleSafetyAlert = (data) => {
      if (data.ride_id === ride.id) {
        setSafetyAlert(data);
      }
    };

    // SOS confirmation from server
    const handleSosConfirmed = (data) => {
      setSosConfirmed(data || { contacts_notified: 0, location_link: '' });
    };

    on('ride_location_update', handleLocationUpdate);
    on('ride_status_changed', handleStatusChange);
    on('safety_alert', handleSafetyAlert);
    on('sos_confirmed', handleSosConfirmed);

    return () => {
      off('ride_location_update');
      off('ride_status_changed');
      off('safety_alert');
      off('sos_confirmed');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [ride, on, off, emit, joinRoom, onClose, activeDriver]);

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

  // Show "still searching" warning after 3 minutes
  useEffect(() => {
    if (rideStatus !== 'searching') return;
    const t = setTimeout(() => setSearchingTooLong(true), 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [rideStatus]);

  const statusSteps = [
    { label: 'Searching',       status: 'searching',        icon: faClock },
    { label: 'Driver Assigned', status: 'driver_assigned',  icon: faCar },
    { label: 'Arriving',        status: 'driver_arriving',  icon: faLocationDot },
    { label: 'In Progress',     status: 'in_progress',      icon: faFlag },
    { label: 'Completed',       status: 'completed',        icon: faLocationDot },
  ];

  const getStepIndex = (status) => {
    const index = statusSteps.findIndex(s => s.status === status);
    return index >= 0 ? index : 0;
  };

  const currentStep = getStepIndex(rideStatus);

  const handleSOS = () => {
    if (showSosConfirm) {
      // Confirmed: send SOS with geolocation if available
      setSosConfirmed({ pending: true });
      setShowSosConfirm(false);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => emit('passenger_sos', { 
            ride_id: ride.id, passenger_id: ride.passenger_id, 
            lat: pos.coords.latitude, lng: pos.coords.longitude,
            notify_contacts: sosOptions.contacts, notify_police: sosOptions.police
          }),
          (err) => emit('passenger_sos', { 
            ride_id: ride.id, passenger_id: ride.passenger_id,
            notify_contacts: sosOptions.contacts, notify_police: sosOptions.police
          })
        );
      } else {
        emit('passenger_sos', { 
          ride_id: ride.id, passenger_id: ride.passenger_id,
          notify_contacts: sosOptions.contacts, notify_police: sosOptions.police
        });
      }
    } else {
      setShowSosConfirm(true);
    }
  };

  const ALERT_LABELS = {
    unusual_stop:    '⚠️ Unusual Stop Detected',
    route_deviation: '⚠️ Route Deviation Detected',
    speed_violation: '⚠️ Speed Violation Detected',
    sos:             '🆘 SOS Alert Active',
  };

  return (
    <>
      {/* Local Toast inside ActiveRideTracking */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[10006] px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-white text-sm font-bold animate-fade-in-up ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 ml-1">&times;</button>
        </div>
      )}

      {/* Driver Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 z-[10005] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center animate-fade-in">
          <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[80vh] animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white flex justify-between items-center rounded-t-3xl md:rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black">
                  {activeDriver?.name?.[0]?.toUpperCase()}
                </div>
                <div className="text-left">
                  <h3 className="font-black text-sm">{activeDriver?.name}</h3>
                  <p className="text-[10px] opacity-80">Driver · Active Chat</p>
                </div>
              </div>
              <button 
                onClick={() => setShowChat(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 max-h-[40vh] min-h-[30vh]">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'passenger' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm text-left ${
                    msg.sender === 'passenger' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-sm'
                  }`}>
                    <p>{msg.text}</p>
                    <span className="text-[9px] opacity-60 block text-right mt-1">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMockMessage} className="p-3 bg-white border-t border-gray-100 flex gap-2 rounded-b-3xl">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message to driver..."
                className="flex-grow bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal (shown first on completion) */}
      {showPayment && (
        <PaymentModal
          ride={completedRide || ride}
          onSuccess={() => {
            setShowPayment(false);
            setShowRating(true);
          }}
          onClose={() => {
            setShowPayment(false);
            setShowRating(true); // skip payment, still show rating
          }}
        />
      )}

      {/* Rating Modal (shown after payment) */}
      {showRating && (
        <RatingModal
          ride={completedRide || ride}
          driver={activeDriver}
          onClose={() => {
            setShowRating(false);
            onClose();
          }}
        />
      )}

    <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center animate-fade-in">
      <div className="bg-white w-full md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-slide-up md:animate-scale-in max-h-screen flex flex-col">

        {/* Searching too long banner */}
        {searchingTooLong && rideStatus === 'searching' && (
          <div className="bg-amber-500 text-white px-6 py-3 flex items-center gap-3 animate-fade-in">
            <FontAwesomeIcon icon={faClock} className="flex-shrink-0 animate-pulse" />
            <p className="font-bold text-sm flex-1">Still searching for a driver... You can cancel this ride if you'd like.</p>
          </div>
        )}

        {/* Close confirmation for active rides */}
        {showCloseConfirm && (
          <div className="bg-gray-800 text-white px-6 py-4 flex items-center gap-4 animate-fade-in">
            <p className="text-sm font-bold flex-1">Your ride is still active. Close tracking anyway?</p>
            <button onClick={onClose} className="px-3 py-1.5 bg-white text-gray-900 text-xs font-black rounded-xl">Yes, close</button>
            <button onClick={() => setShowCloseConfirm(false)} className="px-3 py-1.5 bg-gray-700 text-white text-xs font-black rounded-xl">Stay</button>
          </div>
        )}

        {/* Safety Alert Banner */}
        {safetyAlert && (
          <div className="bg-red-600 text-white px-6 py-3 flex items-center gap-3 animate-fade-in">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-xl animate-pulse flex-shrink-0" />
            <div className="flex-1">
              <p className="font-black text-sm">{ALERT_LABELS[safetyAlert.alert_type] || '⚠️ Safety Alert'}</p>
              <p className="text-xs opacity-80">Severity: {(safetyAlert.score * 100).toFixed(0)}% · Admin has been notified</p>
            </div>
            <button onClick={() => setSafetyAlert(null)} className="opacity-70 hover:opacity-100">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}

        {/* Enhanced SOS Active Modal */}
        {sosConfirmed && (
          <div className="absolute inset-0 z-[10010] bg-red-600 flex flex-col items-center justify-center p-6 text-center animate-fade-in overflow-y-auto">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 animate-pulse flex-shrink-0">
              <FontAwesomeIcon icon={faTriangleExclamation} className="text-white text-4xl" />
            </div>
            <h2 className="text-2xl font-black text-white mb-1">SOS ACTIVE</h2>
            {sosConfirmed.pending ? (
              <p className="text-red-100 font-bold mb-6">Activating emergency response...</p>
            ) : (
              <div className="mb-6 space-y-1">
                {sosConfirmed.notified_police && <p className="text-red-100 font-bold text-sm">Police control room has been alerted.</p>}
                <p className="text-white font-black text-sm">Help is on the way. Please contact your emergency contacts below:</p>
              </div>
            )}

            {/* Direct WhatsApp SOS Contact Links */}
            {!sosConfirmed.pending && sosConfirmed.emergency_contacts && sosConfirmed.emergency_contacts.length > 0 && (
              <div className="w-full max-w-sm bg-black/10 rounded-2xl p-4 space-y-2.5 mb-6 border border-white/10 text-left">
                <p className="text-[10px] font-bold text-red-200 uppercase tracking-wider mb-1.5">Tap to send SOS on WhatsApp:</p>
                {sosConfirmed.emergency_contacts.map((contact, idx) => {
                  const cleanNumber = cleanPhoneForWhatsApp(contact.phone);
                  const waLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(sosConfirmed.whatsapp_message || '')}`;
                  return (
                    <a
                      key={idx}
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl p-3 text-xs font-black transition-all shadow-md active:scale-95 border border-emerald-500/20"
                    >
                      <div className="flex flex-col">
                        <span className="text-[10px] text-emerald-100 opacity-80">{contact.relationship || 'Emergency Contact'}</span>
                        <span className="text-sm font-black text-white">{contact.name}</span>
                      </div>
                      <span className="bg-white/20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide">
                        Send SOS
                      </span>
                    </a>
                  );
                })}
              </div>
            )}

            <div className="w-full max-w-sm space-y-3">
              <a href="tel:100" className="w-full flex items-center justify-between bg-white text-red-600 rounded-2xl p-3.5 font-black text-md shadow-lg hover:scale-102 transition-transform">
                <span>Call Police</span>
                <span className="bg-red-50 px-3 py-1 rounded-xl text-red-500 text-sm">100</span>
              </a>
              <a href="tel:1091" className="w-full flex items-center justify-between bg-white text-red-600 rounded-2xl p-3.5 font-black text-md shadow-lg hover:scale-102 transition-transform">
                <span>Women Helpline</span>
                <span className="bg-red-50 px-3 py-1 rounded-xl text-red-500 text-sm">1091</span>
              </a>
              <a href="tel:112" className="w-full flex items-center justify-between bg-white text-red-600 rounded-2xl p-3.5 font-black text-md shadow-lg hover:scale-102 transition-transform">
                <span>Emergency Dial</span>
                <span className="bg-red-50 px-3 py-1 rounded-xl text-red-500 text-sm">112</span>
              </a>

              {!sosConfirmed.pending && sosConfirmed.whatsapp_message && (
                <a 
                  href={`https://wa.me/?text=${encodeURIComponent(sosConfirmed.whatsapp_message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-2xl p-3.5 font-black text-sm shadow-lg hover:scale-102 transition-transform border border-emerald-500/20"
                >
                  Share with other WhatsApp contacts
                </a>
              )}
            </div>

            {!sosConfirmed.pending && sosConfirmed.location_link && (
              <div className="mt-6 bg-black/20 p-4 rounded-2xl backdrop-blur-sm max-w-sm w-full">
                <p className="text-red-100 text-[10px] font-bold mb-1.5 uppercase tracking-wide">Your Live SOS Location Link</p>
                <div className="bg-white/10 p-3 rounded-xl break-all text-[11px] text-white font-mono border border-white/20 select-all">
                  {sosConfirmed.location_link}
                </div>
              </div>
            )}

            <button onClick={() => setSosConfirmed(null)} className="mt-6 text-red-200 text-xs underline font-bold hover:text-white mb-4">
              Hide this screen
            </button>
          </div>
        )}

        {/* SOS Confirm Dialog */}
        {showSosConfirm && !sosConfirmed && (
          <div className="bg-red-50 border-b-2 border-red-200 px-6 py-5 flex flex-col gap-4 animate-fade-in relative z-[10010]">
            <div className="flex items-start gap-4">
              <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-600 text-3xl flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="font-black text-red-900 text-lg">Send emergency SOS?</p>
                <p className="text-sm text-red-700 mb-4">Select who you want to notify immediately:</p>
                <label className="flex items-center gap-3 mb-3 cursor-pointer group">
                  <input type="checkbox" checked={sosOptions.contacts} onChange={e => setSosOptions({...sosOptions, contacts: e.target.checked})} className="w-5 h-5 text-red-600 border-red-300 rounded focus:ring-red-500" />
                  <span className="text-sm font-bold text-red-900 group-hover:text-red-700 transition-colors">Alert Emergency Contacts via Telegram</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={sosOptions.police} onChange={e => setSosOptions({...sosOptions, police: e.target.checked})} className="w-5 h-5 text-red-600 border-red-300 rounded focus:ring-red-500" />
                  <span className="text-sm font-bold text-red-900 group-hover:text-red-700 transition-colors">Alert Police Control Room</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-red-200/50">
              <button onClick={() => setShowSosConfirm(false)}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-black rounded-xl hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button onClick={handleSOS}
                disabled={!sosOptions.contacts && !sosOptions.police}
                className="px-5 py-2.5 bg-red-600 text-white text-sm font-black rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md">
                Confirm SOS
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white relative">
          <div className="flex items-center gap-3 absolute top-4 right-4">
            {/* SOS Button */}
            <button
              onClick={handleSOS}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-black transition-all shadow-lg"
              title="Send emergency SOS"
            >
              <FontAwesomeIcon icon={faTriangleExclamation} />
              SOS
            </button>
            {/* Close */}
            <button
              onClick={() => {
                const activeStatuses = ['searching', 'driver_assigned', 'driver_arriving', 'in_progress'];
                if (activeStatuses.includes(rideStatus)) {
                  setShowCloseConfirm(true);
                } else {
                  onClose();
                }
              }}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xl" />
            </button>
          </div>
          
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
              {activeDriver && (
                <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-2xl font-black">
                    {activeDriver.name[0]}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-lg text-gray-900">{activeDriver.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FontAwesomeIcon icon={faStar} className="text-yellow-500" />
                      <span className="font-bold">{activeDriver.avg_rating?.toFixed(1) || '5.0'}</span>
                      <span className="text-gray-400">•</span>
                      <span>{activeDriver.vehicle_type || 'Sedan'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:${activeDriver?.phone || '+919876543210'}`}
                      onClick={() => setToast({ msg: `Initiating call to ${activeDriver?.name || 'Driver'} at ${activeDriver?.phone || '+91 98765 43210'}...`, type: 'success' })}
                      className="w-10 h-10 bg-emerald-100 hover:bg-emerald-200 rounded-full flex items-center justify-center transition-all"
                      title={`Call ${activeDriver?.name || 'Driver'}`}
                    >
                      <FontAwesomeIcon icon={faPhone} className="text-emerald-600" />
                    </a>
                    <button
                      title="Chat with driver"
                      onClick={() => setShowChat(true)}
                      className="w-10 h-10 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center transition-all"
                    >
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

              {/* Cancel ride button (Issue 11) */}
              {['searching', 'driver_assigned', 'driver_arriving', 'in_progress'].includes(rideStatus) && (
                <button
                  onClick={handleCancelRide}
                  disabled={cancelling}
                  className="w-full mt-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black rounded-xl uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelling ? (
                    <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Cancelling...</>
                  ) : (
                    'Cancel Ride'
                  )}
                </button>
              )}

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
    </>
  );
};

export default ActiveRideTracking;
