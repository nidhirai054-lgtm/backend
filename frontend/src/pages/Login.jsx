import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldHalved, faLeaf, faUsers, faCarSide, faEnvelope, faLock, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';

const Login = () => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const u = await login(email, password);
      navigate(u.role === 'admin' ? '/dashboard' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-green flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-white/10 rounded-full"></div>
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/10 rounded-full"></div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <FontAwesomeIcon icon={faCarSide} className="text-white text-lg" />
          </div>
          <span className="text-2xl font-black tracking-tight">SmartRide</span>
        </div>
        <div className="relative z-10 space-y-6">
          {[
            { icon: faShieldHalved, title: 'AI-Powered Safety',      desc: 'Real-time anomaly detection keeps every ride safe' },
            { icon: faLeaf,         title: 'Green Rides',             desc: 'Track your CO₂ savings and earn green points' },
            { icon: faUsers,        title: 'Verified Communities',    desc: 'Ride with trusted people from your institution' },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <FontAwesomeIcon icon={f.icon} className="text-white" />
              </div>
              <div>
                <p className="font-black">{f.title}</p>
                <p className="text-sm opacity-70">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="relative z-10 text-xs opacity-50">© 2025 SmartRide. Safe. Green. Smart.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md animate-scale-in">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 gradient-green rounded-xl flex items-center justify-center">
              <FontAwesomeIcon icon={faCarSide} className="text-white" />
            </div>
            <span className="text-xl font-black text-gray-900">SmartRide</span>
          </div>

          <h2 className="text-3xl font-black text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-400 text-sm mb-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-emerald-600 font-bold hover:underline">Sign up free</Link>
          </p>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 animate-fade-in">
              <FontAwesomeIcon icon={faShieldHalved} className="text-red-500 text-lg" />
              <p className="text-red-700 text-sm font-semibold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">Email</label>
              <div className="relative">
                <FontAwesomeIcon icon={faEnvelope} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-all"
                  placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">Password</label>
              <div className="relative">
                <FontAwesomeIcon icon={faLock} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-all"
                  placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full gradient-green text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl hover:opacity-95 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Signing in...</>
                : <><FontAwesomeIcon icon={faArrowRight} /> Sign In</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
