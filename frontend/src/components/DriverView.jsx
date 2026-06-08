import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCarSide, faRightFromBracket, faLocationDot, faFlag,
  faClock, faCheckCircle, faSpinner, faStar, faLeaf,
  faTriangleExclamation, faArrowRight, faUser, faRoad,
  faCircleCheck, faXmark, faBell,
} from '@fortawesome/free-solid-svg-icons';
import api from '../api/axios';
import MapView from './MapView';
import useSocket from '../hooks/useSocket';

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in-up
    ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
    <span className="font-semibold text-sm">{msg}</span>
    <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100">
      <FontAwesomeIcon icon={faXmark} />
    </button>
  </div>
);

// Status label → next action button label
const ACTION_MAP = {
  driver_assigned: { label: 'Set Off to Pickup',  nextStatus: 'driver_arriving', color: 'bg-blue-500 hover:bg-blue-600',    icon: faArrowRight },
  driver_arriving: { label: 'Passenger On Board', nextStatus: 'in_progress',    color: 'bg-emerald-500 hover:bg-emerald-600', icon: faUser },
  in_progress:     { label: 'Complete Trip',       nextStatus: 'completed',       color: 'bg-violet-500 hover:bg-violet-600', icon: faCircleCheck },
};

const STATUS_INFO = {
  driver_assigned: { label: 'Ride Assigned',    color: '#0ea5e9' },
  driver_arriving: { label: 'Driving to Pickup', color: '#f59e0b' },
  in_progress:     { label: 'Trip In Progress',  color: '#10b981' },
  completed:       { label: 'Completed',         color: '#6366f1' },
  cancelled:       { label: 'Cancelled',         color: '#ef4444' },
};

const DriverView = ({ user, logout, location, isConnected }) => {
  const { emit, on, off } = useSocket();
  const [availableRides, setAvailableRides] = useState([]);
  const [activeRide,     setActiveRide]     = useState(null);
  const [recentRides,    setRecentRides]    = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [actionLoading,  setActionLoading]  = useState(false);
  const [polling,        setPolling]        = useState(true);
  const [toast,          setToast]          = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Join drivers room for instant new ride notifications
  useEffect(() => {
    if (!isConnected) return;
    emit('join_drivers_room', {});
  }, [isConnected, emit]);

  // Listen for instant new ride push
  useEffect(() => {
    const handleNewRide = (ride) => {
      setAvailableRides(prev => {
        if (prev.find(r => r.id === ride.id)) return prev;
        return [ride, ...prev];
      });
    };
    on('new_ride_available', handleNewRide);
    return () => off('new_ride_available');
  }, [on, off]);

  // ── Fetch available (searching) rides — only on mount ─────────────────────
  const fetchAvailable = useCallback(async () => {
    try {
      let url = '/rides/available';
      if (location && location.lat && location.lng) {
        url += `?lat=${location.lat}&lng=${location.lng}`;
      }
      const res = await api.get(url);
      // Merge: add any rides not already in state (don't overwrite declined ones)
      setAvailableRides(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const newRides = (res.data || []).filter(r => !existingIds.has(r.id));
        return [...prev, ...newRides];
      });
    } catch {
      // silent
    }
  }, [location]);

  // Emit driver location updates to backend during active rides
  useEffect(() => {
    if (!activeRide || !location || !location.lat || !location.lng) return;
    if (!['driver_assigned', 'driver_arriving', 'in_progress'].includes(activeRide.status)) return;

    const sendUpdate = () => {
      emit('update_driver_location', {
        ride_id: activeRide.id,
        lat: location.lat,
        lng: location.lng,
        heading: 0,
        speed_kmh: 30.0
      });
    };

    sendUpdate();
    const interval = setInterval(sendUpdate, 5000);
    return () => clearInterval(interval);
  }, [location.lat, location.lng, activeRide?.id, activeRide?.status, emit]);

  // ── Fetch current active ride (driver_assigned / arriving / in_progress) ──
  const fetchActiveRide = useCallback(async () => {
    try {
      const res = await api.get('/rides/');
      const all  = res.data || [];
      const active = all.find(r =>
        ['driver_assigned', 'driver_arriving', 'in_progress'].includes(r.status)
      );
      setActiveRide(active || null);
      setRecentRides(all.filter(r => r.status === 'completed').slice(0, 5));
    } catch {
      // silent
    }
  }, [user.id]);

  useEffect(() => {
    fetchActiveRide();
    fetchAvailable();
  }, [fetchActiveRide, fetchAvailable]);

  // Polling loop — only polls for active ride status, not available rides
  // Available rides come in via socket (new_ride_available) + initial fetch
  useEffect(() => {
    if (!polling) return;
    const iv = setInterval(() => {
      fetchActiveRide();
    }, 8000);
    return () => clearInterval(iv);
  }, [polling, fetchActiveRide]);

  // ── Accept a ride ─────────────────────────────────────────────────────────
  const handleAccept = async (ride) => {
    setLoading(true);
    try {
      const res = await api.patch(`/rides/${ride.id}/accept`);
      setActiveRide(res.data.ride);
      setAvailableRides([]);
      setPolling(false);
      showToast('Ride accepted! Head to the pickup location.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to accept ride', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Decline (dismiss from local state only) ───────────────────────────────
  const handleDecline = (rideId) => {
    setAvailableRides(prev => prev.filter(r => r.id !== rideId));
  };

  // ── Driver advances ride lifecycle ────────────────────────────────────────
  const handleAction = async () => {
    if (!activeRide) return;
    const action = ACTION_MAP[activeRide.status];
    if (!action) return;

    setActionLoading(true);
    try {
      const res = await api.patch(`/rides/${activeRide.id}/update-status`, {
        status: action.nextStatus,
      });
      setActiveRide(res.data.ride);

      if (action.nextStatus === 'completed') {
        showToast('Trip completed! Great job.', 'success');
        setActiveRide(null);
        setPolling(true);
        fetchAvailable();
        fetchActiveRide();
      } else {
        showToast(`Status updated: ${STATUS_INFO[action.nextStatus]?.label}`, 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const action = activeRide ? ACTION_MAP[activeRide.status] : null;

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

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="w-full md:w-[400px] bg-white border-r border-gray-100 flex flex-col overflow-y-auto shadow-xl z-20">

          {/* Connection status */}
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {isConnected ? 'Live Connection Active' : 'Offline — Reconnecting...'}
            </span>
          </div>

          {/* ── ACTIVE RIDE PANEL ──────────────────────────────────────────── */}
          {activeRide ? (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: STATUS_INFO[activeRide.status]?.color }} />
                <p className="text-xs font-black uppercase tracking-widest"
                  style={{ color: STATUS_INFO[activeRide.status]?.color }}>
                  {STATUS_INFO[activeRide.status]?.label}
                </p>
              </div>

              {/* Ride card */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow" />
                    <div className="w-0.5 h-6 bg-gray-300" />
                    <FontAwesomeIcon icon={faFlag} className="text-red-500 text-xs" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Pickup</p>
                      <p className="text-sm font-black text-gray-900 leading-tight">
                        {activeRide.pickup?.address || 'Pickup location'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Dropoff</p>
                      <p className="text-sm font-black text-gray-900 leading-tight">
                        {activeRide.dropoff?.address || 'Dropoff location'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-1 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-lg font-black text-gray-900">₹{activeRide.fare?.toFixed(0)}</p>
                    <p className="text-[9px] text-gray-400 uppercase">Fare</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-gray-900">{activeRide.distance_km?.toFixed(1)} km</p>
                    <p className="text-[9px] text-gray-400 uppercase">Distance</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-emerald-600 flex items-center gap-1">
                      <FontAwesomeIcon icon={faLeaf} className="text-xs" />
                      +{activeRide.green_points_awarded || 0}
                    </p>
                    <p className="text-[9px] text-gray-400 uppercase">Green Pts</p>
                  </div>
                </div>
              </div>

              {/* Risk label */}
              {activeRide.risk_label && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                  activeRide.risk_label === 'green'  ? 'bg-emerald-50 text-emerald-700' :
                  activeRide.risk_label === 'yellow' ? 'bg-yellow-50 text-yellow-700'  :
                                                        'bg-red-50 text-red-700'
                }`}>
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  Driver Risk: {activeRide.risk_label.toUpperCase()} ({(activeRide.risk_score * 100).toFixed(0)}%)
                </div>
              )}

              {/* Action button */}
              {action && (
                <button
                  onClick={handleAction}
                  disabled={actionLoading}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-black text-sm transition-all shadow-lg disabled:opacity-60 ${action.color}`}
                >
                  {actionLoading
                    ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    : <FontAwesomeIcon icon={action.icon} />
                  }
                  {actionLoading ? 'Updating...' : action.label}
                </button>
              )}

              {/* Completed state */}
              {activeRide.status === 'completed' && (
                <div className="text-center py-4 animate-fade-in">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-4xl text-emerald-500 mb-2" />
                  <p className="font-black text-gray-800">Trip Completed!</p>
                  <p className="text-sm text-gray-400">Ready for your next ride.</p>
                </div>
              )}
            </div>

          ) : availableRides.length > 0 ? (
            /* ── INCOMING RIDE REQUESTS ──────────────────────────────────── */
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faBell} className="text-amber-500 animate-bounce" />
                  Ride Requests
                </p>
                <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-full">
                  {availableRides.length} nearby
                </span>
              </div>

              {availableRides.map((ride) => (
                <div key={ride.id}
                  className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 animate-fade-in-up space-y-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow" />
                      <div className="w-0.5 h-6 bg-gray-300" />
                      <FontAwesomeIcon icon={faFlag} className="text-red-500 text-xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase font-bold">Pickup</p>
                        <p className="text-sm font-black text-gray-900 leading-tight truncate">
                          {ride.pickup?.address}
                        </p>
                      </div>
                      <div className="mt-2">
                        <p className="text-[9px] text-gray-400 uppercase font-bold">Dropoff</p>
                        <p className="text-sm font-black text-gray-900 leading-tight truncate">
                          {ride.dropoff?.address}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 border-t border-amber-200 pt-2">
                    <div>
                      <p className="text-sm font-black text-gray-900">₹{ride.fare?.toFixed(0)}</p>
                      <p className="text-[9px] text-gray-400 uppercase">Fare</p>
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{ride.distance_km?.toFixed(1)} km</p>
                      <p className="text-[9px] text-gray-400 uppercase">Distance</p>
                    </div>
                    {ride.distance_to_pickup_km && (
                      <div>
                        <p className="text-sm font-black text-blue-600">
                          <FontAwesomeIcon icon={faRoad} className="mr-1 text-xs" />
                          {ride.distance_to_pickup_km} km
                        </p>
                        <p className="text-[9px] text-gray-400 uppercase">From you</p>
                      </div>
                    )}
                    {ride.ride_type === 'EV' && (
                      <div className="ml-auto">
                        <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                          EV
                        </span>
                      </div>
                    )}
                    {ride.women_only && (
                      <div className="ml-auto">
                        <span className="bg-pink-100 text-pink-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                          Women Only
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(ride)}
                      disabled={loading}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {loading
                        ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        : <FontAwesomeIcon icon={faCheckCircle} />
                      }
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(ride.id)}
                      className="px-4 py-2.5 bg-white border-2 border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-500 hover:text-red-500 font-black text-sm rounded-xl transition-all"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          ) : (
            /* ── IDLE STATE ──────────────────────────────────────────────── */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 gradient-green rounded-3xl flex items-center justify-center mb-4 shadow-lg">
                <FontAwesomeIcon icon={faCarSide} className="text-white text-3xl" />
              </div>
              <p className="text-lg font-black text-gray-700 mb-1">Ready for Rides</p>
              <p className="text-sm text-gray-400 mb-4">Searching for nearby ride requests...</p>
              <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-emerald-500 text-sm" />
                <span className="text-xs font-bold text-gray-500">Live polling every 8s</span>
              </div>
            </div>
          )}

          {/* ── Recent completed rides ──────────────────────────────────── */}
          {recentRides.length > 0 && !activeRide && (
            <div className="px-5 pb-5 mt-auto border-t border-gray-100 pt-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Recent Trips</p>
              <div className="space-y-2">
                {recentRides.slice(0, 3).map((r, i) => (
                  <div key={r.id || i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {r.pickup?.address?.split(',')[0]} → {r.dropoff?.address?.split(',')[0]}
                      </p>
                      <p className="text-[9px] text-gray-400">{r.distance_km?.toFixed(1)} km · {r.ride_type}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-sm font-black text-gray-900">₹{r.fare?.toFixed(0)}</p>
                      <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5 justify-end">
                        <FontAwesomeIcon icon={faLeaf} className="text-[8px]" />
                        +{r.green_points_awarded || 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Driver stat card */}
          <div className="px-5 pb-5 mt-4">
            <div className="gradient-green rounded-2xl p-4 text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-1">Your Rating</p>
                  <p className="text-3xl font-black">{user?.avg_rating?.toFixed(1) || '5.0'}
                    <FontAwesomeIcon icon={faStar} className="text-yellow-300 text-lg ml-1" />
                  </p>
                  <p className="text-xs opacity-70 mt-0.5">Keep up the great work!</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] opacity-60 uppercase">Green Pts</p>
                  <p className="text-xl font-black text-emerald-200">
                    <FontAwesomeIcon icon={faLeaf} className="mr-1 text-sm" />
                    {user?.green_points || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <div className="flex-grow relative overflow-hidden bg-gray-200">
          <MapView 
            userLocation={location} 
            drivers={[]}
            pickup={activeRide?.pickup} 
            dropoff={activeRide?.dropoff} 
          />
          <div className="absolute top-4 right-4 glass px-3 py-1.5 rounded-full shadow flex items-center gap-2 z-[1000]">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-[10px] font-black text-gray-600 uppercase tracking-tight">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DriverView;
