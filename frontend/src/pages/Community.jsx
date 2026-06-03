import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faArrowLeft, faUserTie, faPersonWalking,
  faStar, faLeaf, faMedal, faTrophy, faCrown,
  faChartBar, faRankingStar, faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import api from '../api/axios';

const MEDAL_ICONS = [faCrown, faMedal, faTrophy];
const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7c2f'];

const Community = () => {
  const [community,  setCommunity]  = useState(null);
  const [members,    setMembers]    = useState([]);
  const [reputation, setReputation] = useState([]);
  const [tab,     setTab]     = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/community/'),
      api.get('/community/members'),
      api.get('/community/reputation'),
    ]).then(([c, m, r]) => {
      setCommunity(c.data);
      setMembers(m.data);
      setReputation(r.data);
    }).catch(err => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-5 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <FontAwesomeIcon icon={faUsers} className="text-sky-500" /> Community
            </h1>
            <p className="text-sm text-gray-400">{community?.name || 'Your verified circle'}</p>
          </div>
          <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-600 transition-all">
            <FontAwesomeIcon icon={faArrowLeft} /> Home
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl animate-fade-in">{error}</div>
        ) : !community || community.community === null ? (
          <div className="text-center py-20 animate-fade-in">
            <FontAwesomeIcon icon={faUsers} className="text-5xl text-gray-200 mb-4" />
            <p className="text-lg font-black text-gray-400">Not part of any community yet</p>
            <p className="text-sm text-gray-300 mt-2">Communities are auto-assigned by email domain</p>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="gradient-blue rounded-3xl p-7 text-white relative overflow-hidden animate-fade-in-up">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full"></div>
              <div className="absolute right-10 -bottom-6 w-24 h-24 bg-white/10 rounded-full"></div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1 opacity-60">
                    <FontAwesomeIcon icon={faShieldHalved} className="text-xs" />
                    <p className="text-xs font-black uppercase tracking-widest">Verified Community</p>
                  </div>
                  <h2 className="text-3xl font-black">{community.name}</h2>
                  <p className="text-sm opacity-70 mt-1">@{community.email_domain}</p>
                  {community.women_only && (
                    <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-black">
                      <FontAwesomeIcon icon={faShieldHalved} /> Women-Only
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-5xl font-black">{community.member_count}</p>
                  <p className="text-xs opacity-60 uppercase">Members</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-4 pt-4 border-t border-white/20">
                {[
                  { icon: faUserTie,       label: 'Drivers',    value: drivers.length },
                  { icon: faPersonWalking, label: 'Passengers', value: passengers.length },
                  { icon: faStar,          label: 'Avg Rating', value: `${avgRating}` },
                  { icon: faLeaf,          label: 'Green Pts',  value: totalGreen },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex items-center gap-1.5 opacity-60 mb-0.5">
                      <FontAwesomeIcon icon={s.icon} className="text-xs" />
                      <p className="text-[10px] uppercase">{s.label}</p>
                    </div>
                    <p className="text-xl font-black">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit animate-fade-in-up stagger-1">
              {[
                { key: 'overview',     icon: faChartBar,    label: 'Overview' },
                { key: 'members',      icon: faUsers,       label: 'Members' },
                { key: 'leaderboard',  icon: faRankingStar, label: 'Leaderboard' },
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

            {/* Overview */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-scale-in">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 card-hover">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faChartBar} className="text-sky-500" />
                    <p className="text-sm font-black text-gray-700">Top Members by Reputation</p>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={top5} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      <Bar dataKey="rep" name="Reputation" radius={[6,6,0,0]}>
                        {top5.map((_, i) => <Cell key={i} fill={['#10b981','#0ea5e9','#6366f1','#f59e0b','#ec4899'][i % 5]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {topMember && (
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 card-hover">
                    <div className="flex items-center gap-2 mb-1">
                      <FontAwesomeIcon icon={faCrown} className="text-yellow-500" />
                      <p className="text-sm font-black text-gray-700">Top Member Profile</p>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{topMember.name}</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#f0f0f0" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 700 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 card-hover">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faLeaf} className="text-emerald-500" />
                    <p className="text-sm font-black text-gray-700">Green Points Distribution</p>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={top5} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      <Bar dataKey="green" name="Green Points" radius={[6,6,0,0]} fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Members */}
            {tab === 'members' && (
              <div className="space-y-3 animate-scale-in">
                {members.map((m, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 flex items-center justify-between border border-gray-100 card-hover animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.04}s` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm"
                        style={{ background: m.role === 'driver' ? 'linear-gradient(135deg,#10b981,#0d9488)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
                        {m.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{m.name}</p>
                        <p className="text-[10px] text-gray-400">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        m.role === 'driver' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                      }`}>
                        <FontAwesomeIcon icon={m.role === 'driver' ? faUserTie : faPersonWalking} />
                        {m.role}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-black text-yellow-500">
                        <FontAwesomeIcon icon={faStar} className="text-[10px]" />
                        {m.avg_rating?.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Leaderboard */}
            {tab === 'leaderboard' && (
              <div className="space-y-3 animate-scale-in">
                {reputation.map((m, i) => (
                  <div key={i} className={`bg-white rounded-2xl p-4 flex items-center gap-4 border card-hover animate-fade-in-up ${
                    i === 0 ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-100'
                  }`} style={{ animationDelay: `${i * 0.04}s` }}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      i < 3 ? 'bg-white shadow-md' : 'bg-gray-100'
                    }`}>
                      {i < 3
                        ? <FontAwesomeIcon icon={MEDAL_ICONS[i]} style={{ color: MEDAL_COLORS[i] }} className="text-lg" />
                        : <span className="text-sm font-black text-gray-400">{i + 1}</span>
                      }
                    </div>
                    <div className="flex-grow">
                      <p className="font-black text-gray-900">{m.name}</p>
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden w-full max-w-[200px]">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(m.reputation_score * 10, 100)}%`, backgroundColor: i === 0 ? '#f59e0b' : '#10b981' }}>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-5 text-center">
                      <div>
                        <p className="text-sm font-black text-gray-900">{m.reputation_score?.toFixed(1)}</p>
                        <p className="text-[9px] text-gray-400 uppercase">Rep</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-emerald-600">{m.green_points}</p>
                        <p className="text-[9px] text-gray-400 uppercase flex items-center gap-0.5 justify-center">
                          <FontAwesomeIcon icon={faLeaf} className="text-[8px]" /> Green
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-yellow-500 flex items-center gap-1 justify-center">
                          <FontAwesomeIcon icon={faStar} className="text-xs" />{m.avg_rating?.toFixed(1)}
                        </p>
                        <p className="text-[9px] text-gray-400 uppercase">Rating</p>
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
