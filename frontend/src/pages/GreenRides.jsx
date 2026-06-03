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
  faArrowLeft, faArrowTrendUp, faFireFlameCurved,
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

const GreenRides = () => {
  const { user } = useAuth();
  const [rides,   setRides]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/rides/').then(r => setRides(r.data)).catch(console.error).finally(() => setLoading(false));
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
    { icon: faLeaf,           label: 'Green Points',  value: animPts.toFixed(0),        color: '#10b981' },
    { icon: faWind,           label: 'CO₂ Saved',     value: `${animCO2.toFixed(1)}kg`, color: '#0ea5e9' },
    { icon: faBolt,           label: 'EV Rides',      value: evCount,                   color: '#6366f1' },
    { icon: faBus,            label: 'Pooled Rides',  value: poolCount,                 color: '#f59e0b' },
  ];

  const rideTypeIcon = { EV: faBolt, pooled: faBus, solo: faCarSide };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 text-xs">
        <p className="font-black text-gray-700">{label}</p>
        <p className="text-emerald-600 font-bold">{payload[0].value} kg CO₂ saved</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-5 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <FontAwesomeIcon icon={faLeaf} className="text-emerald-500" /> Green Impact
            </h1>
            <p className="text-sm text-gray-400">Your sustainability footprint</p>
          </div>
          <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-600 transition-all">
            <FontAwesomeIcon icon={faArrowLeft} /> Home
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="gradient-green rounded-3xl p-8 text-white relative overflow-hidden animate-fade-in-up">
              <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full"></div>
              <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-white/10 rounded-full"></div>
              <div className="flex items-center gap-2 mb-2 opacity-70">
                <FontAwesomeIcon icon={faWind} />
                <p className="text-sm font-black uppercase tracking-widest">Total CO₂ Offset</p>
              </div>
              <p className="text-6xl font-black">{animCO2.toFixed(1)} <span className="text-2xl opacity-70">kg</span></p>
              <div className="flex items-center gap-2 mt-2 opacity-70">
                <FontAwesomeIcon icon={faTree} />
                <p className="text-sm">{animTree} trees planted equivalent</p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-6 pt-4 border-t border-white/20">
                <div>
                  <p className="text-2xl font-black">{animPts.toFixed(0)}</p>
                  <p className="text-xs opacity-60 uppercase flex items-center gap-1"><FontAwesomeIcon icon={faLeaf} /> Green Points</p>
                </div>
                <div>
                  <p className="text-2xl font-black">{evCount}</p>
                  <p className="text-xs opacity-60 uppercase flex items-center gap-1"><FontAwesomeIcon icon={faBolt} /> EV Rides</p>
                </div>
                <div>
                  <p className="text-2xl font-black">{poolCount}</p>
                  <p className="text-xs opacity-60 uppercase flex items-center gap-1"><FontAwesomeIcon icon={faBus} /> Pooled</p>
                </div>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {statCards.map((s, i) => (
                <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 card-hover animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.07}s` }}>
                  <FontAwesomeIcon icon={s.icon} className="text-2xl mb-3" style={{ color: s.color }} />
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 card-hover animate-fade-in-up stagger-2">
                <div className="flex items-center gap-2 mb-1">
                  <FontAwesomeIcon icon={faArrowTrendUp} className="text-emerald-500" />
                  <p className="text-sm font-black text-gray-700">CO₂ Saved Over Time</p>
                </div>
                <p className="text-xs text-gray-400 mb-4">kg per ride date</p>
                {co2Timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={co2Timeline}>
                      <defs>
                        <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="co2" stroke="#10b981" strokeWidth={2.5} fill="url(#co2Grad)" dot={{ fill: '#10b981', r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-300 text-sm">No completed rides yet</div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 card-hover animate-fade-in-up stagger-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FontAwesomeIcon icon={faFireFlameCurved} className="text-emerald-500" />
                    <p className="text-sm font-black text-gray-700">Green Ride %</p>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">EV + Pooled of all rides</p>
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={120}>
                      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={radialData} startAngle={90} endAngle={-270}>
                        <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#f3f4f6' }} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-2xl font-black text-emerald-600">{greenPct}%</p>
                    </div>
                  </div>
                </div>

                {typeData.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 card-hover animate-fade-in-up stagger-4">
                    <p className="text-sm font-black text-gray-700 mb-3">By Ride Type</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <PieChart>
                        <Pie data={typeData} cx="50%" cy="50%" outerRadius={40} dataKey="value" paddingAngle={3}>
                          {typeData.map(d => <Cell key={d.name} fill={d.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {typeData.map(d => (
                        <div key={d.name} className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }}></div>
                          <span className="text-[10px] font-bold text-gray-500">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* History */}
            <div className="animate-fade-in-up stagger-5">
              <p className="text-sm font-black text-gray-700 mb-3">Green Ride History</p>
              {completed.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
                  <FontAwesomeIcon icon={faLeaf} className="text-4xl text-gray-200 mb-3" />
                  <p className="text-gray-400 font-bold">No completed rides yet</p>
                  <Link to="/" className="mt-2 inline-block text-emerald-600 font-bold hover:underline text-sm">Book a green ride</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {completed.map((ride, i) => (
                    <div key={ride.id} className="bg-white rounded-xl p-4 flex items-center justify-between border border-gray-100 card-hover animate-fade-in-up"
                      style={{ animationDelay: `${i * 0.04}s` }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: ride.ride_type === 'EV' ? '#d1fae5' : ride.ride_type === 'pooled' ? '#dbeafe' : '#ede9fe' }}>
                          <FontAwesomeIcon icon={rideTypeIcon[ride.ride_type] || faCarSide}
                            style={{ color: ride.ride_type === 'EV' ? '#10b981' : ride.ride_type === 'pooled' ? '#0ea5e9' : '#6366f1' }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">
                            {ride.pickup?.address || 'Pickup'} → {ride.dropoff?.address || 'Dropoff'}
                          </p>
                          <p className="text-[10px] text-gray-400">{new Date(ride.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-600">{ride.co2_saved?.toFixed(2)} kg</p>
                        <p className="text-[10px] font-bold text-sky-500">+{ride.green_points_awarded} pts</p>
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
