import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faArrowLeft, faUserTie, faPersonWalking,
  faStar, faLeaf, faMedal, faTrophy, faCrown,
  faChartBar, faRankingStar, faShieldHalved, faCarSide, faCar,
  faSpinner, faRotateRight, faGear,
} from '@fortawesome/free-solid-svg-icons';
import api from '../api/axios';

const MEDAL_ICONS  = [faCrown, faMedal, faTrophy];
const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7c2f'];

const Community = () => {
  const { user, logout } = useAuth();
  const [community,  setCommunity]  = useState(null);
  const [members,    setMembers]    = useState([]);
  const [reputation, setReputation] = useState([]);
  const [tab,     setTab]     = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const fetchData = () => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/community/'),
      api.get('/community/members'),
      api.get('/community/reputation'),
    ]).then(([c, m, r]) => {
      setCommunity(c.data);
      setMembers(m.data);
      setReputation(r.data);
    }).catch(err => {
      const msg = err.response?.data?.error || 'Failed to load';
      // "Not part of any community" is an expected state — show the nice empty state
      if (msg.toLowerCase().includes('not part') || msg.toLowerCase().includes('no community') || err.response?.status === 404) {
        setCommunity({ community: null });
      } else {
        setError(msg);
      }
    }).finally(() => setLoading(false));
  };


  useEffect(() => { fetchData(); }, []);

  const drivers    = members.filter(m => m.role === 'driver');
  const passengers = members.filter(m => m.role === 'passenger');
  const avgRating  = members.length ? (members.reduce((s, m) => s + (m.avg_rating || 0), 0) / members.length).toFixed(1) : 0;
  const totalGreen = reputation.reduce((s, m) => s + (m.green_points || 0), 0);

  const top5 = reputation.slice(0, 5).map(m => ({ name: m.name.split(' ')[0], rep: m.reputation_score, green: m.green_points }));
  const topMember = reputation[0];
  const radarData = topMember ? [
    { metric: 'Reputation', value: Math.min(topMember.reputation_score * 10, 100) },
    { metric: 'Rating',     value: (topMember.avg_rating / 5) * 100 },
    { metric: 'Green Pts',  value: Math.min(topMember.green_points, 100) },
  ] : [];

  const noData = !community || community.community === null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar — matches Home */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-md">
            <FontAwesomeIcon icon={faUsers} className="text-white text-sm" />
          </div>
          <div>
            <span className="text-xl font-black text-gray-900 tracking-tight">Community</span>
            <p className="text-[10px] text-gray-400 font-bold leading-none">
              {loading ? 'Loading...' : community?.name || 'Your verified circle'}
            </p>
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
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
            <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <FontAwesomeIcon icon={faUsers} className="text-white text-2xl animate-pulse" />
            </div>
            <p className="text-gray-500 font-bold">Loading your community...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon icon={faUsers} className="text-3xl text-red-300" />
            </div>
            <p className="text-gray-700 font-black text-lg mb-2">Something went wrong</p>
            <p className="text-gray-400 text-sm mb-6">{error}</p>
            <button onClick={fetchData}
              className="inline-flex items-center gap-2 px-6 py-3 gradient-green text-white font-black rounded-2xl shadow-md hover:opacity-90 transition-all">
              <FontAwesomeIcon icon={faRotateRight} /> Try Again
            </button>
          </div>
        )}

        {/* Not in a community */}
        {!loading && !error && noData && (
          <div className="animate-fade-in">
            {/* Decorative header */}
            <div className="bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50 border border-indigo-100 rounded-3xl p-10 text-center mb-6 relative overflow-hidden shadow-sm">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-indigo-100/60 rounded-full" />
              <div className="absolute -left-4 -bottom-6 w-28 h-28 bg-sky-100/60 rounded-full" />
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                  <FontAwesomeIcon icon={faUsers} className="text-white text-3xl" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Join a Community</h2>
                <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed mb-6">
                  Communities are automatically assigned based on your email domain. Once assigned, you'll see verified riders and drivers from your organization.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link to="/space" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-black rounded-2xl shadow-md hover:opacity-90 transition-all">
                    <FontAwesomeIcon icon={faUsers} /> Explore Space
                  </Link>
                  <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 font-black rounded-2xl hover:bg-gray-50 transition-all shadow-sm">
                    <FontAwesomeIcon icon={faCarSide} /> Book a Ride
                  </Link>
                </div>
              </div>
            </div>

            {/* Feature preview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: faRankingStar, color: 'from-amber-400 to-orange-400', bg: 'from-amber-50 to-orange-50', border: 'border-amber-100', title: 'Leaderboard', desc: 'See who has the highest reputation and green score in your circle' },
                { icon: faShieldHalved, color: 'from-sky-400 to-indigo-500', bg: 'from-sky-50 to-indigo-50', border: 'border-sky-100', title: 'Verified Members', desc: 'Ride with trusted people from your own organization' },
                { icon: faLeaf, color: 'from-emerald-400 to-teal-500', bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-100', title: 'Green Impact', desc: 'Track collective CO₂ savings and green points as a community' },
              ].map(card => (
                <div key={card.title} className={`bg-gradient-to-br ${card.bg} border ${card.border} rounded-2xl p-5 shadow-sm`}>
                  <div className={`w-10 h-10 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center mb-3 shadow-sm`}>
                    <FontAwesomeIcon icon={card.icon} className="text-white text-sm" />
                  </div>
                  <p className="font-black text-gray-800 text-sm mb-1">{card.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Community loaded */}
        {!loading && !error && !noData && (
          <>
            {/* Hero */}
            <div className="bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 rounded-3xl p-7 text-white relative overflow-hidden animate-fade-in-up shadow-xl">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
              <div className="absolute right-10 -bottom-6 w-24 h-24 bg-white/10 rounded-full" />
              <div className="absolute left-1/3 -bottom-4 w-16 h-16 bg-white/5 rounded-full" />
              <div className="relative z-10">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 opacity-70">
                      <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon icon={faShieldHalved} className="text-[10px]" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-widest">Verified Community</p>
                    </div>
                    <h2 className="text-3xl font-black">{community.name}</h2>
                    <p className="text-sm opacity-60 mt-1">@{community.email_domain}</p>
                    {community.women_only && (
                      <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-black">
                        <FontAwesomeIcon icon={faShieldHalved} /> Women-Only
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-6xl font-black">{community.member_count}</p>
                    <p className="text-xs opacity-60 uppercase mt-1">Members</p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-4 gap-4 pt-5 border-t border-white/20">
                  {[
                    { icon: faUserTie,        label: 'Drivers',    value: drivers.length },
                    { icon: faPersonWalking,  label: 'Passengers', value: passengers.length },
                    { icon: faStar,           label: 'Avg Rating', value: avgRating },
                    { icon: faLeaf,           label: 'Green Pts',  value: totalGreen },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="flex items-center gap-1.5 opacity-60 mb-1">
                        <FontAwesomeIcon icon={s.icon} className="text-xs" />
                        <p className="text-[10px] uppercase font-bold">{s.label}</p>
                      </div>
                      <p className="text-2xl font-black">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit animate-fade-in-up stagger-1">
              {[
                { key: 'overview',    icon: faChartBar,    label: 'Overview' },
                { key: 'members',     icon: faUsers,       label: 'Members' },
                { key: 'leaderboard', icon: faRankingStar, label: 'Leaderboard' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                    tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  <FontAwesomeIcon icon={t.icon} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-scale-in">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 card-hover shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-sky-50 rounded-xl flex items-center justify-center">
                      <FontAwesomeIcon icon={faChartBar} className="text-sky-500 text-sm" />
                    </div>
                    <p className="text-sm font-black text-gray-800">Top Members by Reputation</p>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={top5} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      <Bar dataKey="rep" name="Reputation" radius={[6,6,0,0]}>
                        {top5.map((_, i) => <Cell key={i} fill={['#10b981','#0ea5e9','#6366f1','#f59e0b','#ec4899'][i % 5]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {topMember && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 card-hover shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                        <FontAwesomeIcon icon={faCrown} className="text-amber-500 text-sm" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800">Top Member Profile</p>
                        <p className="text-xs text-gray-400">{topMember.name}</p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#f0f0f0" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 700, fill: '#6b7280' }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 card-hover shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <FontAwesomeIcon icon={faLeaf} className="text-emerald-500 text-sm" />
                    </div>
                    <p className="text-sm font-black text-gray-800">Green Points Distribution</p>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={top5} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      <Bar dataKey="green" name="Green Points" radius={[6,6,0,0]} fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Members tab */}
            {tab === 'members' && (
              <div className="space-y-3 animate-scale-in">
                {members.length === 0 ? (
                  <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FontAwesomeIcon icon={faUsers} className="text-2xl text-gray-300" />
                    </div>
                    <p className="text-gray-400 font-bold">No members found</p>
                  </div>
                ) : (
                  members.map((m, i) => (
                    <div key={i}
                      className="bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100 card-hover animate-fade-in-up shadow-sm"
                      style={{ animationDelay: `${i * 0.04}s` }}>
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-sm shadow-sm"
                          style={{ background: m.role === 'driver' ? 'linear-gradient(135deg,#10b981,#0d9488)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
                          {m.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{m.name}</p>
                          <p className="text-[10px] text-gray-400">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          m.role === 'driver' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-sky-50 text-sky-700 border border-sky-100'
                        }`}>
                          <FontAwesomeIcon icon={m.role === 'driver' ? faUserTie : faPersonWalking} />
                          {m.role}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-black text-amber-500 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                          <FontAwesomeIcon icon={faStar} className="text-[10px]" />
                          {m.avg_rating?.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Leaderboard tab */}
            {tab === 'leaderboard' && (
              <div className="space-y-3 animate-scale-in">
                {reputation.map((m, i) => (
                  <div key={i}
                    className={`bg-white rounded-2xl p-5 flex items-center gap-4 border card-hover animate-fade-in-up shadow-sm ${
                      i === 0 ? 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-yellow-50/50' : 'border-gray-100'
                    }`}
                    style={{ animationDelay: `${i * 0.04}s` }}>
                    {/* Rank badge */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      i < 3 ? 'shadow-md' : 'bg-gray-100'
                    }`}
                    style={i < 3 ? { background: `linear-gradient(135deg, ${['#fef3c7,#f59e0b','#f1f5f9,#94a3b8','#fef3c7,#cd7c2f'][i]})` } : {}}>
                      {i < 3
                        ? <FontAwesomeIcon icon={MEDAL_ICONS[i]} style={{ color: MEDAL_COLORS[i] }} className="text-lg" />
                        : <span className="text-sm font-black text-gray-400">{i + 1}</span>
                      }
                    </div>

                    {/* Name + bar */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="font-black text-gray-900 truncate">{m.name}</p>
                        {i === 0 && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Champion</span>}
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full max-w-[240px]">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(m.reputation_score * 10, 100)}%`, backgroundColor: i === 0 ? '#f59e0b' : '#10b981' }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-center flex-shrink-0">
                      <div>
                        <p className="text-sm font-black text-gray-900">{m.reputation_score?.toFixed(1)}</p>
                        <p className="text-[9px] text-gray-400 uppercase font-bold">Rep</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-emerald-600">{m.green_points}</p>
                        <p className="text-[9px] text-gray-400 uppercase font-bold flex items-center gap-0.5 justify-center">
                          <FontAwesomeIcon icon={faLeaf} className="text-[8px]" /> Green
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-amber-500 flex items-center gap-1 justify-center">
                          <FontAwesomeIcon icon={faStar} className="text-xs" />{m.avg_rating?.toFixed(1)}
                        </p>
                        <p className="text-[9px] text-gray-400 uppercase font-bold">Rating</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Community;
