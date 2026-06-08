import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCarSide, faMoneyBillWave, faLeaf, faBolt, faArrowLeft,
  faCircleXmark, faSpinner, faRoad, faCalendarDays, faUsers,
  faLocationDot, faArrowRight, faChartPie, faCar, faGear,
} from '@fortawesome/free-solid-svg-icons';
import api from '../api/axios';
import { rideEvents, RIDE_EVENTS } from '../utils/rideEvents';

const STATUS_COLORS = {
  searching:       '#9ca3af',
  driver_assigned: '#f59e0b',
  driver_arriving: '#3b82f6',
  in_progress:     '#10b981',
  completed:       '#0ea5e9',
  cancelled:       '#ef4444',
};
const STATUS_LABELS = {
  searching:       'Searching',
  driver_assigned: 'Driver Assigned',
  driver_arriving: 'Driver Arriving',
  in_progress:     'In Progress',
  completed:       'Completed',
  cancelled:       'Cancelled',
};
const RISK_COLORS = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' };
const TYPE_COLORS = { solo: '#6366f1', pooled: '#0ea5e9', EV: '#10b981' };
const TYPE_BG     = { solo: '#eef2ff', pooled: '#e0f2fe', EV: '#d1fae5' };

const Badge = ({ label, color }) => (
  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide"
    style={{ backgroundColor: `${color}18`, color }}>
    {label}
  </span>
);

const SkeletonCard = () => (
  <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-3 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className="skeleton w-12 h-12 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-2 w-1/2 rounded" />
      </div>
    </div>
    <div className="skeleton h-3 w-3/4 rounded" />
    <div className="skeleton h-3 w-1/2 rounded" />
    <div className="grid grid-cols-4 gap-3 pt-3 border-t border-gray-50">
      {[1,2,3,4].map(i => <div key={i} className="skeleton h-8 rounded-xl" />)}
    </div>
  </div>
);

const MyRides = () => {
  const { user } = useAuth();
  const [rides,      setRides]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('all');
  const [cancelling, setCancelling] = useState(null);
  const [toast,      setToast]      = useState(null);

  const showToast = (msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api.get('/rides/')
      .then(r => setRides(r.data))
      .catch(() => showToast('Failed to load rides.'))
      .finally(() => setLoading(false));

    // Listen for ride events from other components
    const handleRideBooked = ({ ride }) => {
      setRides(prev => [ride, ...prev]);
    };

    const handleRideUpdated = ({ ride }) => {
      setRides(prev => prev.map(r => r.id === ride.id ? ride : r));
    };

    const handleRideCancelled = ({ rideId }) => {
      setRides(prev => prev.map(r => r.id === rideId ? { ...r, status: 'cancelled' } : r));
    };

    rideEvents.on(RIDE_EVENTS.RIDE_BOOKED, handleRideBooked);
    rideEvents.on(RIDE_EVENTS.RIDE_UPDATED, handleRideUpdated);
    rideEvents.on(RIDE_EVENTS.RIDE_CANCELLED, handleRideCancelled);

    return () => {
      rideEvents.off(RIDE_EVENTS.RIDE_BOOKED, handleRideBooked);
      rideEvents.off(RIDE_EVENTS.RIDE_UPDATED, handleRideUpdated);
      rideEvents.off(RIDE_EVENTS.RIDE_CANCELLED, handleRideCancelled);
    };
  }, []);

  const cancelRide = async (id) => {
    setCancelling(id);
    try {
      await api.post(`/rides/cancel/${id}`);
      setRides(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
      rideEvents.emit(RIDE_EVENTS.RIDE_CANCELLED, { rideId: id });
      showToast('Ride cancelled successfully.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to cancel');
    } finally {
      setCancelling(null);
    }
  };

  const ACTIVE_STATUSES = ['searching', 'driver_assigned', 'driver_arriving', 'in_progress'];
  const filtered  = filter === 'all'  ? rides
    : filter === 'active'  ? rides.filter(r => ACTIVE_STATUSES.includes(r.status))
    : rides.filter(r => r.status === filter);

  const byType    = ['solo', 'pooled', 'EV'].map(t => ({ name: t, value: rides.filter(r => r.ride_type === t).length })).filter(d => d.value > 0);
  const byStatus  = Object.keys(STATUS_COLORS).map(s => ({ name: s, value: rides.filter(r => r.status === s).length })).filter(d => d.value > 0);
  const totalFare = rides.reduce((s, r) => s + (r.fare || 0), 0);
  const totalCO2  = rides.reduce((s, r) => s + (r.co2_saved || 0), 0);
  const activeNow = rides.filter(r => ACTIVE_STATUSES.includes(r.status)).length;
  const completed = rides.filter(r => r.status === 'completed').length;

  const summaryCards = [
    { label: 'Total Rides',  value: rides.length,              icon: faCar,           color: '#6366f1', bg: 'from-indigo-50 to-violet-100', border: 'border-indigo-200' },
    { label: 'Total Spent',  value: `₹${totalFare.toFixed(0)}`, icon: faMoneyBillWave, color: '#f59e0b', bg: 'from-amber-50 to-yellow-100',   border: 'border-amber-200' },
    { label: 'CO₂ Saved',   value: `${totalCO2.toFixed(1)} kg`, icon: faLeaf,          color: '#10b981', bg: 'from-emerald-50 to-green-100',  border: 'border-emerald-200' },
    { label: 'Active Now',   value: activeNow,                  icon: faBolt,          color: '#0ea5e9', bg: 'from-sky-50 to-blue-100',        border: 'border-sky-200' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-white text-sm font-bold animate-fade-in-up border ${
          toast.type === 'success' ? 'bg-emerald-600 border-emerald-700' : 'bg-red-600 border-red-700'
        }`}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 ml-1 text-lg leading-none">×</button>
        </div>
      )}

      {/* Navbar — matches Home */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 gradient-green rounded-xl flex items-center justify-center shadow-md">
            <FontAwesomeIcon icon={faCarSide} className="text-white text-sm" />
          </div>
          <div>
            <span className="text-xl font-black text-gray-900 tracking-tight">My Rides</span>
            <p className="text-[10px] text-gray-400 font-bold leading-none">
              {loading ? 'Loading...' : `${rides.length} total rides`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/green-rides" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all">
            <FontAwesomeIcon icon={faLeaf} className="text-xs text-emerald-500" /> Green Impact
          </Link>
          <Link to="/community" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all">
            <FontAwesomeIcon icon={faUsers} className="text-xs" /> Community
          </Link>
          <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-600 transition-all">
            <FontAwesomeIcon icon={faArrowLeft} /> Home
          </Link>
          <Link to="/settings" title="Settings" className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all">
            <FontAwesomeIcon icon={faGear} className="text-sm" />
          </Link>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
            <div className="w-6 h-6 gradient-green rounded-full flex items-center justify-center text-white text-xs font-black">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-bold text-gray-800 hidden sm:block">{user?.name}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {summaryCards.map((s, i) => (
            <div key={s.label}
              className={`bg-gradient-to-br ${s.bg} rounded-2xl p-5 border ${s.border} card-hover animate-fade-in-up shadow-sm`}
              style={{ animationDelay: `${i * 0.07}s` }}>
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3">
                <FontAwesomeIcon icon={s.icon} className="text-lg" style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts row — only shown when rides exist */}
        {rides.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up stagger-2">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 card-hover shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <FontAwesomeIcon icon={faChartPie} className="text-indigo-500 text-sm" />
                </div>
                <p className="text-sm font-black text-gray-800">Rides by Type</p>
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={byType} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value">
                    {byType.map(entry => <Cell key={entry.name} fill={TYPE_COLORS[entry.name]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {byType.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[d.name] }} />
                    <span className="text-xs font-bold text-gray-500 capitalize">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 card-hover shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-sky-50 rounded-xl flex items-center justify-center">
                  <FontAwesomeIcon icon={faCar} className="text-sky-500 text-sm" />
                </div>
                <p className="text-sm font-black text-gray-800">Rides by Status</p>
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={byStatus} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(v, n, p) => [v, STATUS_LABELS[p.payload.name] || p.payload.name]}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }}
                  />
                  <Bar dataKey="value" radius={[6,6,0,0]}>
                    {byStatus.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit animate-fade-in-up stagger-3 overflow-x-auto">
          {[
            { key: 'all',       label: 'All',       count: rides.length },
            { key: 'active',    label: 'Active',    count: activeNow },
            { key: 'completed', label: 'Completed', count: completed },
            { key: 'cancelled', label: 'Cancelled', count: rides.filter(r => r.status === 'cancelled').length },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${
                filter === key ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                filter === key ? 'bg-gray-100 text-gray-600' : 'bg-transparent opacity-60'
              }`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Ride cards */}
        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <FontAwesomeIcon icon={faCarSide} className="text-4xl text-gray-300" />
            </div>
            <p className="text-xl font-black text-gray-700 mb-2">No rides found</p>
            <p className="text-gray-400 text-sm mb-6">
              {filter === 'all' ? "You haven't taken any rides yet." : `No ${filter} rides found.`}
            </p>
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 gradient-green text-white font-black rounded-2xl shadow-md hover:opacity-90 transition-all">
              <FontAwesomeIcon icon={faCar} /> Book a Ride
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ride, i) => {
              const statusColor = STATUS_COLORS[ride.status] || '#ccc';
              const typeColor   = TYPE_COLORS[ride.ride_type] || '#6b7280';
              const typeBg      = TYPE_BG[ride.ride_type]    || '#f3f4f6';
              const isActive    = ACTIVE_STATUSES.includes(ride.status);

              return (
                <div key={ride.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden card-hover animate-fade-in-up shadow-sm"
                  style={{ animationDelay: `${i * 0.05}s` }}>
                  {/* Status accent top bar */}
                  <div className="h-1 w-full" style={{ backgroundColor: statusColor }} />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-wrap gap-2 items-center">
                        {/* Type pill with icon */}
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase"
                          style={{ backgroundColor: typeBg, color: typeColor }}>
                          <FontAwesomeIcon icon={ride.ride_type === 'EV' ? faBolt : ride.ride_type === 'pooled' ? faUsers : faCarSide} className="text-[9px]" />
                          {ride.ride_type}
                        </span>
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase"
                          style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>
                          {STATUS_LABELS[ride.status] || ride.status}
                        </span>
                        {ride.women_only && <Badge label="Women Only" color="#ec4899" />}
                        {ride.risk_label && <Badge label={`Risk: ${ride.risk_label}`} color={RISK_COLORS[ride.risk_label] || '#999'} />}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold ml-2 whitespace-nowrap flex-shrink-0">
                        <FontAwesomeIcon icon={faCalendarDays} />
                        {new Date(ride.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>

                    {/* Route */}
                    <div className="flex items-stretch gap-3 mb-4">
                      <div className="flex flex-col items-center gap-0 pt-1.5 flex-shrink-0">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
                        <div className="w-0.5 flex-1 bg-gradient-to-b from-emerald-200 to-sky-200 my-1" style={{ minHeight: 20 }} />
                        <div className="w-3 h-3 rounded-full bg-sky-400 shadow-sm" />
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="bg-gray-50 rounded-xl px-3 py-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-0.5 flex items-center gap-1">
                            <FontAwesomeIcon icon={faLocationDot} className="text-emerald-400" /> Pickup
                          </p>
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {ride.pickup?.address || `${ride.pickup?.lat?.toFixed(4)}, ${ride.pickup?.lng?.toFixed(4)}`}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-3 py-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-0.5 flex items-center gap-1">
                            <FontAwesomeIcon icon={faLocationDot} className="text-sky-400" /> Dropoff
                          </p>
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {ride.dropoff?.address || `${ride.dropoff?.lat?.toFixed(4)}, ${ride.dropoff?.lng?.toFixed(4)}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Metrics strip */}
                    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-50">
                      {[
                        { label: 'Fare',      value: `₹${ride.fare}`,                       icon: faMoneyBillWave, color: '#f59e0b', bg: '#fffbeb' },
                        { label: 'Distance',  value: `${ride.distance_km?.toFixed(1)} km`,   icon: faRoad,          color: '#6366f1', bg: '#eef2ff' },
                        { label: 'CO₂',       value: `${ride.co2_saved?.toFixed(2)} kg`,     icon: faLeaf,          color: '#10b981', bg: '#ecfdf5' },
                        { label: 'Pts',       value: `+${ride.green_points_awarded}`,         icon: faBolt,          color: '#0ea5e9', bg: '#e0f2fe' },
                      ].map(m => (
                        <div key={m.label} className="text-center rounded-xl py-2" style={{ backgroundColor: m.bg }}>
                          <FontAwesomeIcon icon={m.icon} className="text-xs mb-1" style={{ color: m.color }} />
                          <p className="text-xs font-black" style={{ color: m.color }}>{m.value}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Cancel action */}
                    {isActive && (
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
                          <span className="text-xs font-bold text-gray-500">{STATUS_LABELS[ride.status]}</span>
                        </div>
                        <button
                          onClick={() => cancelRide(ride.id)}
                          disabled={cancelling === ride.id}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black rounded-xl transition-all disabled:opacity-50 border border-red-100 uppercase tracking-wide"
                        >
                          <FontAwesomeIcon icon={cancelling === ride.id ? faSpinner : faCircleXmark} className={cancelling === ride.id ? 'animate-spin' : ''} />
                          {cancelling === ride.id ? 'Cancelling...' : 'Cancel Ride'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Book new ride CTA */}
        {!loading && rides.length > 0 && (
          <div className="gradient-green rounded-2xl p-6 text-white flex items-center justify-between shadow-lg animate-fade-in-up">
            <div>
              <p className="font-black text-lg">Ready for another ride?</p>
              <p className="text-sm opacity-80 mt-0.5">Book instantly from the home screen</p>
            </div>
            <Link to="/" className="flex items-center gap-2 px-5 py-3 bg-white text-emerald-600 font-black rounded-2xl text-sm hover:bg-gray-50 transition-all shadow-md">
              Book Now <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRides;
