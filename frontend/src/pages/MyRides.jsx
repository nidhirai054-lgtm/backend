import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCarSide, faMoneyBill, faLeaf, faBolt, faArrowLeft,
  faCircleXmark, faSpinner, faRoute, faRoad, faCalendarDays,
} from '@fortawesome/free-solid-svg-icons';
import api from '../api/axios';

const STATUS_COLORS = { active: '#10b981', pending: '#f59e0b', completed: '#0ea5e9', cancelled: '#ef4444' };
const RISK_COLORS   = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' };
const TYPE_COLORS   = { solo: '#6366f1', pooled: '#0ea5e9', EV: '#10b981' };

const Badge = ({ label, color }) => (
  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide"
    style={{ backgroundColor: `${color}18`, color }}>{label}</span>
);

const SkeletonCard = () => (
  <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-3">
    <div className="skeleton h-4 w-1/3"></div>
    <div className="skeleton h-3 w-2/3"></div>
    <div className="skeleton h-3 w-1/2"></div>
  </div>
);

const MyRides = () => {
  const [rides,      setRides]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('all');
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    api.get('/rides/').then(r => setRides(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const cancelRide = async (id) => {
    setCancelling(id);
    try {
      await api.post(`/rides/cancel/${id}`);
      setRides(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel');
    } finally {
      setCancelling(null);
    }
  };

  const filtered   = filter === 'all' ? rides : rides.filter(r => r.status === filter);
  const byType     = ['solo', 'pooled', 'EV'].map(t => ({ name: t, value: rides.filter(r => r.ride_type === t).length })).filter(d => d.value > 0);
  const byStatus   = Object.keys(STATUS_COLORS).map(s => ({ name: s, value: rides.filter(r => r.status === s).length })).filter(d => d.value > 0);
  const totalFare  = rides.reduce((s, r) => s + (r.fare || 0), 0);
  const totalCO2   = rides.reduce((s, r) => s + (r.co2_saved || 0), 0);

  const summaryCards = [
    { label: 'Total Rides',  value: rides.length,              icon: faCarSide,   color: '#6366f1' },
    { label: 'Total Spent',  value: `₹${totalFare.toFixed(0)}`, icon: faMoneyBill, color: '#f59e0b' },
    { label: 'CO₂ Saved',    value: `${totalCO2.toFixed(1)}kg`, icon: faLeaf,      color: '#10b981' },
    { label: 'Active Now',   value: rides.filter(r => r.status === 'active').length, icon: faBolt, color: '#0ea5e9' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-5 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <FontAwesomeIcon icon={faCarSide} className="text-emerald-500" /> My Rides
            </h1>
            <p className="text-sm text-gray-400">{rides.length} total rides</p>
          </div>
          <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-600 transition-all">
            <FontAwesomeIcon icon={faArrowLeft} /> Home
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {summaryCards.map((s, i) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 card-hover animate-fade-in-up"
              style={{ animationDelay: `${i * 0.07}s` }}>
              <FontAwesomeIcon icon={s.icon} className="text-2xl mb-3" style={{ color: s.color }} />
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        {rides.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up stagger-2">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 card-hover">
              <p className="text-sm font-black text-gray-700 mb-4">Rides by Type</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byType} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                    {byType.map(entry => <Cell key={entry.name} fill={TYPE_COLORS[entry.name]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {byType.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[d.name] }}></div>
                    <span className="text-xs font-bold text-gray-500 capitalize">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 card-hover">
              <p className="text-sm font-black text-gray-700 mb-4">Rides by Status</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byStatus} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {byStatus.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit animate-fade-in-up stagger-3 overflow-x-auto">
          {['all', 'active', 'pending', 'completed', 'cancelled'].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${
                filter === t ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {t} {t !== 'all' && <span className="ml-1 opacity-60">({rides.filter(r => r.status === t).length})</span>}
            </button>
          ))}
        </div>

        {/* Ride cards */}
        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <FontAwesomeIcon icon={faCarSide} className="text-5xl text-gray-200 mb-4" />
            <p className="text-lg font-black text-gray-400">No rides found</p>
            <Link to="/" className="mt-3 inline-block text-emerald-600 font-bold hover:underline">Book your first ride</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ride, i) => (
              <div key={ride.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden card-hover animate-fade-in-up"
                style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="h-1 w-full" style={{ backgroundColor: STATUS_COLORS[ride.status] || '#ccc' }}></div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge label={ride.status}    color={STATUS_COLORS[ride.status] || '#999'} />
                      <Badge label={ride.ride_type} color={TYPE_COLORS[ride.ride_type] || '#999'} />
                      {ride.women_only && <Badge label="Women Only" color="#ec4899" />}
                      {ride.risk_label && <Badge label={`Risk: ${ride.risk_label}`} color={RISK_COLORS[ride.risk_label] || '#999'} />}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold ml-2 whitespace-nowrap">
                      <FontAwesomeIcon icon={faCalendarDays} />
                      {new Date(ride.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                      <div className="w-0.5 h-6 bg-gray-200"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-500"></div>
                    </div>
                    <div className="space-y-2 flex-grow">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase">Pickup</p>
                        <p className="text-sm font-semibold text-gray-800">{ride.pickup?.address || `${ride.pickup?.lat?.toFixed(4)}, ${ride.pickup?.lng?.toFixed(4)}`}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase">Dropoff</p>
                        <p className="text-sm font-semibold text-gray-800">{ride.dropoff?.address || `${ride.dropoff?.lat?.toFixed(4)}, ${ride.dropoff?.lng?.toFixed(4)}`}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 pt-3 border-t border-gray-50">
                    {[
                      { label: 'Fare',       value: `₹${ride.fare}`,                     icon: faMoneyBill, color: '#f59e0b' },
                      { label: 'Distance',   value: `${ride.distance_km?.toFixed(1)} km`, icon: faRoad,      color: '#6366f1' },
                      { label: 'CO₂ Saved', value: `${ride.co2_saved?.toFixed(2)} kg`,   icon: faLeaf,      color: '#10b981' },
                      { label: 'Green Pts', value: `+${ride.green_points_awarded}`,       icon: faBolt,      color: '#0ea5e9' },
                    ].map(m => (
                      <div key={m.label} className="text-center">
                        <FontAwesomeIcon icon={m.icon} className="text-xs mb-1" style={{ color: m.color }} />
                        <p className="text-sm font-black" style={{ color: m.color }}>{m.value}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {['pending', 'active'].includes(ride.status) && (
                    <button onClick={() => cancelRide(ride.id)} disabled={cancelling === ride.id}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black rounded-xl transition-all disabled:opacity-50 uppercase tracking-wide">
                      <FontAwesomeIcon icon={cancelling === ride.id ? faSpinner : faCircleXmark} className={cancelling === ride.id ? 'animate-spin' : ''} />
                      {cancelling === ride.id ? 'Cancelling...' : 'Cancel Ride'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRides;
