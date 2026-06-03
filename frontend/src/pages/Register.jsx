import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCarSide, faEnvelope, faLock, faUser, faVenusMars,
  faIdBadge, faBolt, faGasPump, faSpinner, faArrowRight,
  faPersonWalking, faUserTie,
} from '@fortawesome/free-solid-svg-icons';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', gender: 'female', role: 'passenger', vehicle_type: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = { ...form };
      if (!payload.vehicle_type) delete payload.vehicle_type;
      await register(payload);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-all";
  const labelCls = "text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5";

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 gradient-dark flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute -left-16 -top-16 w-64 h-64 bg-white/5 rounded-full"></div>
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full"></div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 gradient-green rounded-xl flex items-center justify-center">
            <FontAwesomeIcon icon={faCarSide} className="text-white text-lg" />
          </div>
          <span className="text-2xl font-black">SmartRide</span>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black leading-tight mb-4">Join the<br/>smarter way<br/>to ride</h2>
          <p className="text-sm opacity-60">Auto-matched to your college or office community. Safe, green, and affordable rides.</p>
        </div>
        <p className="relative z-10 text-xs opacity-30">© 2025 SmartRide</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 overflow-y-auto">
        <div className="w-full max-w-md animate-scale-in">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-9 h-9 gradient-green rounded-xl flex items-center justify-center">
              <FontAwesomeIcon icon={faCarSide} className="text-white" />
            </div>
            <span className="text-xl font-black text-gray-900">SmartRide</span>
          </div>

          <h2 className="text-3xl font-black text-gray-900 mb-1">Create account</h2>
          <p className="text-gray-400 text-sm mb-6">
            Already have one?{' '}
            <Link to="/login" className="text-emerald-600 font-bold hover:underline">Sign in</Link>
          </p>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 animate-fade-in">
              <FontAwesomeIcon icon={faIdBadge} className="text-red-500 text-lg" />
              <p className="text-red-700 text-sm font-semibold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Full Name</label>
              <div className="relative">
                <FontAwesomeIcon icon={faUser} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="text" required value={form.name} onChange={e => set('name', e.target.value)}
                  className={inputCls} placeholder="Your full name" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <div className="relative">
                <FontAwesomeIcon icon={faEnvelope} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="email" required value={form.email} onChange={e => set('email', e.target.value)}
                  className={inputCls} placeholder="you@college.edu.in" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 px-1">Community auto-assigned by email domain</p>
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <div className="relative">
                <FontAwesomeIcon icon={faLock} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="password" required value={form.password} onChange={e => set('password', e.target.value)}
                  className={inputCls} placeholder="••••••••" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Gender</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faVenusMars} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                  <select value={form.gender} onChange={e => set('gender', e.target.value)}
                    className={inputCls + ' cursor-pointer appearance-none'}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>I am a</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faIdBadge} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                  <select value={form.role} onChange={e => set('role', e.target.value)}
                    className={inputCls + ' cursor-pointer appearance-none'}>
                    <option value="passenger">Passenger</option>
                    <option value="driver">Driver</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Role cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { role: 'passenger', icon: faPersonWalking, desc: 'Book rides' },
                { role: 'driver',    icon: faUserTie,       desc: 'Offer rides' },
              ].map(r => (
                <button key={r.role} type="button" onClick={() => set('role', r.role)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    form.role === r.role ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}>
                  <FontAwesomeIcon icon={r.icon} className={`text-xl mb-2 ${form.role === r.role ? 'text-emerald-600' : 'text-gray-400'}`} />
                  <p className={`text-xs font-black capitalize ${form.role === r.role ? 'text-emerald-700' : 'text-gray-600'}`}>{r.role}</p>
                  <p className="text-[10px] text-gray-400">{r.desc}</p>
                </button>
              ))}
            </div>

            {form.role === 'driver' && (
              <div className="animate-fade-in-up">
                <label className={labelCls}>Vehicle Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: 'EV',     icon: faBolt,     label: 'Electric',  cls: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                    { val: 'petrol', icon: faGasPump,  label: 'Petrol',    cls: 'border-orange-400 bg-orange-50 text-orange-700' },
                  ].map(v => (
                    <button key={v.val} type="button" onClick={() => set('vehicle_type', v.val)}
                      className={`py-3 rounded-2xl border-2 flex items-center justify-center gap-2 text-sm font-black transition-all ${
                        form.vehicle_type === v.val ? v.cls : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}>
                      <FontAwesomeIcon icon={v.icon} />
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full gradient-green text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl hover:opacity-95 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Creating...</>
                : <><FontAwesomeIcon icon={faArrowRight} /> Create Account</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
