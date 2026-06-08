import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PieChart, Pie, Cell,
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLeaf, faBolt, faBus, faCarSide, faTree, faWind,
  faArrowLeft, faArrowTrendUp, faFireFlameCurved, faStar,
  faUsers, faCar, faShieldHalved, faGear,
} from '@fortawesome/free-solid-svg-icons';
import api from '../api/axios';

const useCountUp = (target, duration = 1200) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 text-xs">
      <p className="font-black text-gray-700">{label}</p>
      <p className="text-emerald-600 font-bold">{payload[0].value} kg CO₂ saved</p>
    </div>
  );
};

const GreenRides = () => {
  const { user, logout } = useAuth();
  const [rides,   setRides]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api.get('/rides/')
      .then(r => setRides(r.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const completed = rides.filter(r => r.status === 'completed');
  const totalCO2  = completed.reduce((s, r) => s + (r.co2_saved || 0), 0);
  const totalPts  = completed.reduce((s, r) => s + (r.green_points_awarded || 0), 0);
  const evCount   = completed.filter(r => r.ride_type === 'EV').length;
  const poolCount = completed.filter(r => r.ride_type === 'pooled').length;
  const trees     = Math.floor(totalCO2 / 21);

  const animCO2  = useCountUp(parseFloat(totalCO2.toFixed(2)));
  const animPts  = useCountUp(user?.green_points || totalPts);
  const animTree = useCountUp(trees);

  const co2Timeline = (() => {
    const map = {};
    completed.forEach(r => {
      const d = new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      map[d] = (map[d] || 0) + (r.co2_saved || 0);
    });
    return Object.entries(map).map(([date, co2]) => ({ date, co2: parseFloat(co2.toFixed(2)) }));
  })();

  const typeData = [
    { name: 'EV',     value: evCount,   fill: '#10b981' },
    { name: 'Pooled', value: poolCount, fill: '#0ea5e9' },
    { name: 'Solo',   value: completed.filter(r => r.ride_type === 'solo').length, fill: '#6366f1' },
  ].filter(d => d.value > 0);

  const greenPct  = rides.length ? Math.round(((evCount + poolCount) / rides.length) * 100) : 0;
  const radialData = [{ name: 'Green', value: greenPct, fill: '#10b981' }];

  const statCards = [
    { icon: faLeaf,  label: 'Green Points', value: Math.round(animPts), color: '#10b981', bg: 'from-emerald-50 to-green-100', border: 'border-emerald-200' },
    { icon: faWind,  label: 'CO₂ Saved',    value: `${animCO2.toFixed(1)} kg`, color: '#0ea5e9', bg: 'from-sky-50 to-blue-100', border: 'border-sky-200' },
    { icon: faBolt,  label: 'EV Rides',     value: evCount,   color: '#6366f1', bg: 'from-indigo-50 to-violet-100', border: 'border-indigo-200' },
    { icon: faBus,   label: 'Pooled Rides', value: poolCount, color: '#f59e0b', bg: 'from-amber-50 to-yellow-100', border: 'border-amber-200' },
  ];

  const rideTypeIcon = { EV: faBolt, pooled: faBus, solo: faCarSide };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar — matches Home */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 gradient-green rounded-xl flex items-center justify-center shadow-md">
            <FontAwesomeIcon icon={faLeaf} className="text-white text-sm" />
          </div>
          <div>
            <span className="text-xl font-black text-gray-900 tracking-tight">Green Impact</span>
            <p className="text-[10px] text-gray-400 font-bold leading-none">Your sustainability footprint</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/my-rides" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all">
            <FontAwesomeIcon icon={faCar} className="text-xs" /> My Rides
          </Link>
          <Link to="/space" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all">
            <FontAwesomeIcon icon={faUsers} className="text-xs" /> Space
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
        {loadError ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon icon={faLeaf} className="text-3xl text-red-300" />
            </div>
            <p className="text-lg font-black text-gray-700 mb-2">Failed to load ride data</p>
            <p className="text-sm text-gray-400 mb-6">Check your connection and try again</p>
            <button onClick={() => { setLoadError(false); setLoading(true); api.get('/rides/').then(r => setRides(r.data)).catch(() => setLoadError(true)).finally(() => setLoading(false)); }}
              className="px-6 py-3 gradient-green text-white font-black rounded-2xl transition-all shadow-md hover:opacity-90">
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 gradient-green rounded-2xl flex items-center justify-center shadow-lg">
              <FontAwesomeIcon icon={faLeaf} className="text-white text-2xl animate-pulse" />
            </div>
            <p className="text-gray-500 font-bold">Calculating your impact...</p>
          </div>
        ) : (
          <>
            {/* Hero banner */}
            <div className="gradient-green rounded-3xl p-8 text-white relative overflow-hidden animate-fade-in-up shadow-xl">
              <div className="absolute -right-10 -top-10 w-56 h-56 bg-white/10 rounded-full" />
              <div className="absolute right-16 -bottom-10 w-36 h-36 bg-white/10 rounded-full" />
              <div className="absolute left-1/2 -bottom-6 w-24 h-24 bg-white/5 rounded-full" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3 opacity-80">
                  <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon={faWind} className="text-xs" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest">Total CO₂ Offset</p>
                </div>
                <p className="text-7xl font-black leading-none">{animCO2.toFixed(1)}<span className="text-3xl opacity-70 ml-2">kg</span></p>
                <div className="flex items-center gap-2 mt-3 opacity-80">
                  <FontAwesomeIcon icon={faTree} className="text-sm" />
                  <p className="text-sm font-semibold">{animTree} trees planted equivalent</p>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-6 pt-5 border-t border-white/20">
                  {[
                    { icon: faLeaf, label: 'Green Points', value: Math.round(animPts) },
                    { icon: faBolt, label: 'EV Rides', value: evCount },
                    { icon: faBus,  label: 'Pooled', value: poolCount },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-3xl font-black">{s.value}</p>
                      <p className="text-xs opacity-60 uppercase flex items-center gap-1 mt-1">
                        <FontAwesomeIcon icon={s.icon} className="text-[10px]" /> {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {statCards.map((s, i) => (
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

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* CO2 timeline */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 card-hover animate-fade-in-up stagger-2 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <FontAwesomeIcon icon={faArrowTrendUp} className="text-emerald-500 text-sm" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-800">CO₂ Saved Over Time</p>
                    <p className="text-[10px] text-gray-400">kg saved per ride date</p>
                  </div>
                </div>
                {co2Timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={co2Timeline} className="mt-4">
                      <defs>
                        <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="co2" stroke="#10b981" strokeWidth={2.5} fill="url(#co2Grad)" dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                      <FontAwesomeIcon icon={faArrowTrendUp} className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-gray-400 text-sm font-semibold">No completed rides yet</p>
                    <Link to="/" className="text-emerald-600 text-xs font-bold hover:underline">Book your first green ride →</Link>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Green % gauge */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 card-hover animate-fade-in-up stagger-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <FontAwesomeIcon icon={faFireFlameCurved} className="text-emerald-500 text-sm" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-800">Green Ride %</p>
                      <p className="text-[10px] text-gray-400">EV + Pooled of all rides</p>
                    </div>
                  </div>
                  <div className="relative mt-2">
                    <ResponsiveContainer width="100%" height={110}>
                      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={radialData} startAngle={90} endAngle={-270}>
                        <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#f3f4f6' }} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-2xl font-black text-emerald-600">{greenPct}%</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">Green</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ride type breakdown */}
                {typeData.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 card-hover animate-fade-in-up stagger-4 shadow-sm">
                    <p className="text-sm font-black text-gray-800 mb-3">By Ride Type</p>
                    <ResponsiveContainer width="100%" height={90}>
                      <PieChart>
                        <Pie data={typeData} cx="50%" cy="50%" outerRadius={38} dataKey="value" paddingAngle={4}>
                          {typeData.map(d => <Cell key={d.name} fill={d.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {typeData.map(d => (
                        <div key={d.name} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                          <span className="text-[10px] font-bold text-gray-500">{d.name} ({d.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Achievements banner */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-100 rounded-2xl p-5 flex items-center gap-4 animate-fade-in-up shadow-sm">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                <FontAwesomeIcon icon={faStar} className="text-white text-2xl" />
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-900 text-base">Your Green Score</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {animPts === 0 ? 'Start riding green to earn points and badges!' :
                   animPts < 50 ? '🌱 Seedling — Keep growing your green habits' :
                   animPts < 200 ? '🌿 Sprout — You\'re making a real difference' :
                   animPts < 500 ? '🌳 Tree — A true eco champion!' :
                   '🌍 Planet Saver — Legendary green rider!'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-3xl font-black text-amber-500">{Math.round(animPts)}</p>
                <p className="text-[10px] text-amber-600 font-bold uppercase">Points</p>
              </div>
            </div>

            {/* History */}
            <div className="animate-fade-in-up stagger-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-lg font-black text-gray-900">Green Ride History</p>
                {completed.length > 0 && (
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                    {completed.length} eco ride{completed.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {completed.length === 0 ? (
                <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FontAwesomeIcon icon={faLeaf} className="text-3xl text-emerald-300" />
                  </div>
                  <p className="text-gray-600 font-black text-base mb-1">No green rides yet</p>
                  <p className="text-gray-400 text-sm mb-5">Choose EV or Pooled to start your journey</p>
                  <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 gradient-green text-white font-black rounded-2xl shadow-md hover:opacity-90 transition-all">
                    <FontAwesomeIcon icon={faLeaf} /> Book a Green Ride
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {completed.map((ride, i) => (
                    <div key={ride.id}
                      className="bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100 card-hover animate-fade-in-up shadow-sm"
                      style={{ animationDelay: `${i * 0.04}s` }}>
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: ride.ride_type === 'EV' ? '#d1fae5' : ride.ride_type === 'pooled' ? '#dbeafe' : '#ede9fe' }}>
                          <FontAwesomeIcon icon={rideTypeIcon[ride.ride_type] || faCarSide}
                            style={{ color: ride.ride_type === 'EV' ? '#10b981' : ride.ride_type === 'pooled' ? '#0ea5e9' : '#6366f1' }}
                            className="text-lg" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 truncate max-w-[220px]">
                            {ride.pickup?.address || 'Pickup'} → {ride.dropoff?.address || 'Dropoff'}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(ride.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-600">{ride.co2_saved?.toFixed(2)} kg</p>
                        <p className="text-[10px] font-black text-amber-500 mt-0.5">+{ride.green_points_awarded} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GreenRides;
