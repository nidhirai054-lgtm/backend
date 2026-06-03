import React, { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MapView from '../components/MapView';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShieldHalved, faCarSide, faClock, faBell, faLocationDot,
  faCircleCheck, faRotate, faArrowLeft, faLeaf, faUsers,
  faChartBar, faMapLocationDot, faTriangleExclamation,
  faUserTie, faPersonWalking, faChartPie,
} from '@fortawesome/free-solid-svg-icons';
import api from '../api/axios';

const KPI = ({ icon, label, value, color, delay = 0 }) => (
  <div className="bg-white rounded-2xl p-5 border border-gray-100 card-hover animate-fade-in-up"
    style={{ animationDelay: `${delay}s` }}>
    <div className="flex justify-between items-start mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
        <FontAwesomeIcon icon={icon} style={{ color }} />
      </div>
      <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }}></div>
    </div>
    <p className="text-3xl font-black" style={{ color }}>{value ?? '—'}</p>
    <p className="text-xs font-black text-gray-400 uppercase tracking-wide mt-1">{label}</p>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats,       setStats]       = useState(null);
  const [alerts,      setAlerts]      = useState([]);
  const [liveDrivers, setLiveDrivers] = useState([]);
  const [resolving,   setResolving]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('map');
  const [lastRefresh, setLastRefresh] = useState(null);

  if (user && user.role !== 'admin') return <Navigate to="/" />;

  const fetchData = useCallback(async () => {
    try {
      const [s, a, d] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/safety/alerts'),
        api.get('/dashboard/live-drivers'),
      ]);
      setStats(s.data);
      setAlerts(a.data);
      setLiveDrivers(d.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const resolveAlert = async (id) => {
    setResolving(id);
    try {
      await api.patch(`/safety/alerts/${id}/resolve`);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resolve');
    } finally {
      setResolving(null);
    }
  };

  const unresolved = alerts.filter(a => !a.resolved);

  const rideData = stats ? [
    { name: 'Active',  value: stats.rides.active,  fill: '#10b981' },
    { name: 'Pending', value: stats.rides.pending, fill: '#f59e0b' },
    { name: 'Total',   value: stats.rides.total,   fill: '#0ea5e9' },
  ] : [];

  const userPieData = stats ? [
    { name: 'Passengers', value: stats.users.passengers, fill: '#6366f1' },
    { name: 'Drivers',    value: stats.users.drivers,    fill: '#10b981' },
  ] : [];

  const alertTypeData = (() => {
    const map = {};
    alerts.forEach(a => { map[a.alert_type] = (map[a.alert_type] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
  })();

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex justify-between items-center z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center">
            <FontAwesomeIcon icon={faShieldHalved} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900">Safety Command Center</h1>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block"></span>
              Live Monitoring Active
              {lastRefresh && <span className="text-gray-400 normal-case font-normal ml-1">· {lastRefresh.toLocaleTimeString()}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-600 transition-all">
            <FontAwesomeIcon icon={faRotate} /> Refresh
          </button>
          <Link to="/"
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-600 transition-all">
            <FontAwesomeIcon icon={faArrowLeft} /> Exit
          </Link>
        </div>
      </header>

      <div className="flex-grow flex overflow-hidden">
        {/* Alerts sidebar */}
        <div className="w-80 bg-white border-r border-gray-100 flex flex-col shadow-xl z-10 flex-shrink-0">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faBell} className="text-red-500 text-sm" />
              <p className="font-black text-gray-800 text-sm uppercase tracking-tight">Alerts</p>
              {unresolved.length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded-full animate-pulse font-black">{unresolved.length}</span>
              )}
            </div>
            <span className="text-[10px] text-gray-400">{alerts.length} total</span>
          </div>

          <div className="flex-grow overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="space-y-2 p-2">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl"></div>)}</div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <FontAwesomeIcon icon={faCircleCheck} className="text-4xl text-emerald-200 mb-3" />
                <p className="text-xs font-black text-gray-400 uppercase">All Clear</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={alert.id}
                  className={`p-3 rounded-xl border transition-all animate-fade-in-up ${
                    alert.resolved ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-red-50 border-red-100 hover:border-red-200'
                  }`} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-black rounded uppercase ${
                      alert.resolved ? 'bg-gray-300 text-white' : 'bg-red-600 text-white'
                    }`}>
                      <FontAwesomeIcon icon={alert.resolved ? faCircleCheck : faTriangleExclamation} />
                      {alert.resolved ? 'Resolved' : 'Active'}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] text-gray-400">
                      <FontAwesomeIcon icon={faClock} />
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs font-black text-gray-800 capitalize mb-1">{alert.alert_type.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-grow h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${alert.anomaly_score * 100}%` }}></div>
                    </div>
                    <span className="text-[9px] font-black text-red-500">{(alert.anomaly_score * 100).toFixed(0)}%</span>
                  </div>
                  {!alert.resolved && (
                    <button onClick={() => resolveAlert(alert.id)} disabled={resolving === alert.id}
                      className="w-full flex items-center justify-center gap-1.5 py-1 bg-white border border-gray-200 text-gray-600 text-[9px] font-black rounded-lg uppercase hover:bg-gray-50 transition-all disabled:opacity-50">
                      <FontAwesomeIcon icon={faCircleCheck} />
                      {resolving === alert.id ? 'Resolving...' : 'Mark Resolved'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-grow flex flex-col overflow-hidden">
          {/* KPIs */}
          <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50 border-b border-gray-100">
            <KPI icon={faCarSide}          label="Active Rides"  value={stats?.rides?.active}  color="#10b981" delay={0.05} />
            <KPI icon={faClock}            label="Pending Rides" value={stats?.rides?.pending} color="#f59e0b" delay={0.10} />
            <KPI icon={faTriangleExclamation} label="Open Alerts" value={unresolved.length}    color="#ef4444" delay={0.15} />
            <KPI icon={faLocationDot}      label="Live Drivers"  value={liveDrivers.length}    color="#0ea5e9" delay={0.20} />
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 px-4 pt-3 bg-gray-50">
            {[
              { key: 'map',       icon: faMapLocationDot, label: 'Live Map' },
              { key: 'analytics', icon: faChartBar,       label: 'Analytics' },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-black uppercase tracking-wide transition-all ${
                  activeTab === t.key ? 'bg-white text-gray-900 shadow-sm border border-b-0 border-gray-100' : 'text-gray-400 hover:text-gray-600'
                }`}>
                <FontAwesomeIcon icon={t.icon} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Map */}
          {activeTab === 'map' && (
            <div className="flex-grow relative bg-gray-900 animate-fade-in">
              <MapView userLocation={{ lat: 13.05, lng: 77.59 }} drivers={liveDrivers} />
              {stats && (
                <div className="absolute bottom-6 left-6 right-6 glass-dark rounded-2xl p-5 text-white grid grid-cols-2 md:grid-cols-4 gap-4 z-[1000]">
                  {[
                    { icon: faCarSide,  label: 'Total Rides',  value: stats.rides.total,                                color: 'text-white' },
                    { icon: faLeaf,     label: 'CO₂ Saved',    value: `${stats.green_impact.total_co2_saved_kg}kg`,     color: 'text-emerald-400' },
                    { icon: faChartPie, label: 'Green Points', value: stats.green_impact.total_green_points_distributed, color: 'text-sky-400' },
                    { icon: faUsers,    label: 'Communities',  value: stats.communities,                                color: 'text-violet-400' },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="flex items-center gap-1.5 opacity-50 mb-1">
                        <FontAwesomeIcon icon={s.icon} className="text-xs" />
                        <p className="text-[9px] uppercase tracking-wide">{s.label}</p>
                      </div>
                      <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analytics */}
          {activeTab === 'analytics' && (
            <div className="flex-grow overflow-y-auto p-4 bg-white animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faChartBar} className="text-sky-500" />
                    <p className="text-sm font-black text-gray-700">Ride Status Overview</p>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={rideData} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" radius={[8,8,0,0]}>
                        {rideData.map(d => <Cell key={d.name} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <FontAwesomeIcon icon={faUsers} className="text-violet-500" />
                    <p className="text-sm font-black text-gray-700">User Distribution</p>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={userPieData} cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={4} dataKey="value">
                        {userPieData.map(d => <Cell key={d.name} fill={d.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {alertTypeData.length > 0 && (
                  <div className="lg:col-span-2 bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <FontAwesomeIcon icon={faTriangleExclamation} className="text-red-500" />
                      <p className="text-sm font-black text-gray-700">Alert Types Breakdown</p>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={alertTypeData} barSize={36} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} width={110} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                        <Bar dataKey="value" radius={[0,6,6,0]}>
                          {alertTypeData.map((_, i) => <Cell key={i} fill={['#ef4444','#f59e0b','#8b5cf6'][i % 3]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {stats && (
                  <div className="gradient-green rounded-2xl p-5 text-white relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full"></div>
                    <div className="flex items-center gap-2 mb-3 opacity-70">
                      <FontAwesomeIcon icon={faLeaf} />
                      <p className="text-xs font-black uppercase tracking-widest">Green Impact</p>
                    </div>
                    <p className="text-3xl font-black">{stats.green_impact.total_co2_saved_kg} <span className="text-lg opacity-70">kg CO₂</span></p>
                    <p className="text-sm opacity-70 mt-1">saved across all rides</p>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <p className="text-xl font-black">{stats.green_impact.total_green_points_distributed}</p>
                      <p className="text-xs opacity-60 uppercase">Green Points Distributed</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
