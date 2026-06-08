import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, faUser, faShieldHalved, faPhoneVolume,
  faPlus, faTrash, faSave, faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg text-sm font-bold flex items-center gap-3 animation-slideDown ${
      type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'
    }`}>
      {message}
    </div>
  );
};

const Settings = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const showToast = (message, type = 'success') => setToast({ message, type });

  // ── Profile State ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    gender: user?.gender || 'other'
  });

  // ── Contacts State ─────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await api.get('/auth/emergency-contacts');
        setContacts(res.data);
      } catch (err) {
        console.error('Failed to load contacts:', err);
      }
    };
    if (activeTab === 'safety') fetchContacts();
  }, [activeTab]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.patch('/auth/profile', profile);
      await refreshUser();
      showToast('Profile updated successfully');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactsSave = async () => {
    setIsLoading(true);
    try {
      await api.put('/auth/emergency-contacts', contacts);
      await refreshUser();
      showToast('Emergency contacts saved');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save contacts', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const addContact = () => {
    if (contacts.length >= 3) {
      showToast('Maximum 3 emergency contacts allowed', 'error');
      return;
    }
    setContacts([...contacts, { name: '', phone: '', relationship: '', notify_sms: true, notify_push: true }]);
  };

  const updateContact = (idx, field, value) => {
    const updated = [...contacts];
    updated[idx][field] = value;
    setContacts(updated);
  };

  const removeContact = (idx) => {
    setContacts(contacts.filter((_, i) => i !== idx));
  };

  // ── Render Helpers ─────────────────────────────────────────────────────────
  const tabs = [
    { id: 'profile', label: 'Profile', icon: faUser },
    { id: 'safety', label: 'Safety Contacts', icon: faShieldHalved },
    { id: 'emergency', label: 'Emergency Dial', icon: faPhoneVolume }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center gap-4 sticky top-0 z-30 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h1 className="text-xl font-black text-gray-900">Settings</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Tab Navigation */}
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FontAwesomeIcon icon={tab.icon} className={activeTab === tab.id ? 'text-teal-600' : ''} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab Content: Profile ────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 animation-slideUp">
            <h2 className="text-xl font-black text-gray-900 mb-6">Personal Information</h2>
            <form onSubmit={handleProfileSave} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                <input type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                <input type="email" value={user?.email || ''} disabled
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 cursor-not-allowed" />
                <p className="text-xs text-gray-500 mt-2">Email cannot be changed.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
                <input type="tel" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} placeholder="+91 98765 43210"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Gender</label>
                <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / Prefer not to say</option>
                </select>
              </div>
              <div className="pt-4">
                <button type="submit" disabled={isLoading}
                  className="w-full bg-gray-900 text-white rounded-xl py-3.5 font-bold text-sm hover:bg-gray-800 transition-colors flex justify-center items-center gap-2 disabled:opacity-70">
                  <FontAwesomeIcon icon={faSave} /> {isLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab Content: Safety Contacts ────────────────────────────────── */}
        {activeTab === 'safety' && (
          <div className="animation-slideUp">
            <div className="bg-red-50 border border-red-100 rounded-2xl p-5 mb-6 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FontAwesomeIcon icon={faShieldHalved} />
              </div>
              <div>
                <h3 className="font-bold text-red-900 text-sm mb-1">Emergency SOS Notifications</h3>
                <p className="text-xs text-red-700 leading-relaxed">
                  You can save up to 3 emergency contacts. If you trigger an SOS during a ride, you can send them a pre-filled WhatsApp distress message with your live tracking link instantly.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {contacts.map((contact, idx) => (
                <div key={idx} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-gray-900">Contact {idx + 1}</h4>
                    <button onClick={() => removeContact(idx)} className="text-red-500 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Name</label>
                      <input type="text" value={contact.name} onChange={e => updateContact(idx, 'name', e.target.value)} placeholder="E.g. Mom"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Phone Number</label>
                      <input type="tel" value={contact.phone} onChange={e => updateContact(idx, 'phone', e.target.value)} placeholder="+91 98765..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                    </div>
                  </div>
                </div>
              ))}
              
              {contacts.length === 0 && (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center text-2xl mb-4">
                    <FontAwesomeIcon icon={faUser} />
                  </div>
                  <p className="font-bold text-gray-900 mb-1">No emergency contacts</p>
                  <p className="text-sm text-gray-500 max-w-xs">Add your trusted contacts to keep them informed in case of an emergency.</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {contacts.length < 3 && (
                <button onClick={addContact} className="flex-1 bg-white border border-gray-200 text-gray-900 rounded-xl py-3.5 font-bold text-sm hover:bg-gray-50 transition-colors flex justify-center items-center gap-2">
                  <FontAwesomeIcon icon={faPlus} /> Add Contact
                </button>
              )}
              {contacts.length > 0 && (
                <button onClick={handleContactsSave} disabled={isLoading} className="flex-1 bg-teal-600 text-white rounded-xl py-3.5 font-bold text-sm hover:bg-teal-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-70">
                  <FontAwesomeIcon icon={faSave} /> {isLoading ? 'Saving...' : 'Save Contacts'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Content: Emergency Dial ─────────────────────────────────── */}
        {activeTab === 'emergency' && (
          <div className="animation-slideUp">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Emergency Dial</h2>
              <p className="text-sm text-gray-500">One-tap to dial national emergency services. Requires a mobile device to initiate the call.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a href="tel:100" className="bg-blue-600 hover:bg-blue-700 transition-colors rounded-3xl p-6 flex items-center justify-between group shadow-md shadow-blue-600/20">
                <div>
                  <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Law Enforcement</p>
                  <p className="text-white font-black text-xl">Police (100)</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg group-hover:scale-110 transition-transform">
                  <FontAwesomeIcon icon={faPhoneVolume} />
                </div>
              </a>

              <a href="tel:1091" className="bg-purple-600 hover:bg-purple-700 transition-colors rounded-3xl p-6 flex items-center justify-between group shadow-md shadow-purple-600/20">
                <div>
                  <p className="text-purple-200 text-xs font-bold uppercase tracking-wider mb-1">Specialized Support</p>
                  <p className="text-white font-black text-xl">Women Helpline</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg group-hover:scale-110 transition-transform">
                  <FontAwesomeIcon icon={faPhoneVolume} />
                </div>
              </a>

              <a href="tel:112" className="bg-red-600 hover:bg-red-700 transition-colors rounded-3xl p-6 flex items-center justify-between group shadow-md shadow-red-600/20 sm:col-span-2">
                <div>
                  <p className="text-red-200 text-xs font-bold uppercase tracking-wider mb-1">National Emergency</p>
                  <p className="text-white font-black text-xl">General Emergency (112)</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg group-hover:scale-110 transition-transform">
                  <FontAwesomeIcon icon={faPhoneVolume} />
                </div>
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Settings;
