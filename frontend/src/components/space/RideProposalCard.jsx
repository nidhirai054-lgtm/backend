import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCar, faBolt, faLocationDot, faClock, faUsers,
  faLock, faRocket, faXmark, faUserMinus, faSpinner, faRoute,
} from '@fortawesome/free-solid-svg-icons';
import LocationAutocompleteOSM from '../LocationAutocompleteOSM';

const STATUS_COLOR = {
  open:      'bg-emerald-100 text-emerald-700',
  locked:    'bg-amber-100 text-amber-700',
  searching: 'bg-sky-100 text-sky-700',
  active:    'bg-emerald-100 text-emerald-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-500',
};


const RideProposalCard = ({ proposal, user, actions }) => {
  const [joining,  setJoining] = useState(false);
  const [pickup,   setPickup]  = useState(null);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isOrganiser = proposal.organiser_id === user?.id;
  const myEntry     = proposal.participants?.find(p => p.user_id === user?.id && p.status !== 'kicked');
  const confirmed   = proposal.participants?.filter(p => p.status === 'confirmed') || [];

  const handleJoin = async () => {
    if (!pickup) return;
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await actions.joinProposal(proposal.id, pickup);
      setJoining(false);
      setPickup(null);
      setSuccessMessage('Joined the ride proposal! 🚗');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (successText, fn, ...args) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try { 
      await fn(...args); 
      if (successText) {
        setSuccessMessage(successText);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    }
    catch (err) { setError(err.response?.data?.error || 'Action failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm max-w-md">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={proposal.ride_type === 'EV' ? faBolt : faCar} />
            <span className="font-black text-sm">Group Ride Proposal</span>
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${STATUS_COLOR[proposal.status] || ''}`}>
            {proposal.status}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 opacity-80 text-sm">
          <FontAwesomeIcon icon={faLocationDot} className="text-xs" />
          <span className="truncate">{proposal.destination?.address}</span>
        </div>
        <div className="flex items-center gap-1 opacity-80 text-xs mt-0.5">
          <FontAwesomeIcon icon={faClock} className="text-[10px]" />
          <span>{new Date(proposal.proposed_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Inline error */}
      {error && (
        <div className="px-4 pt-2">
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">{error}</p>
        </div>
      )}

      {/* Inline success */}
      {successMessage && (
        <div className="px-4 pt-2 animate-fade-in">
          <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 font-bold">{successMessage}</p>
        </div>
      )}

      {/* Participants */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-xs text-gray-500 font-bold">
            <FontAwesomeIcon icon={faUsers} />
            <span>{confirmed.length} / {proposal.max_participants} seats</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full flex-1 mx-3 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(confirmed.length / proposal.max_participants) * 100}%` }} />
          </div>
        </div>

        <div className="space-y-1">
          {confirmed.map((p, i) => (
            <div key={p.user_id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {proposal.status === 'locked' && (
                  <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 text-[9px] font-black flex items-center justify-center flex-shrink-0">
                    {p.stop_order || i + 1}
                  </span>
                )}
                <span className="text-xs font-semibold text-gray-700">{p.name}</span>
                <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
                  {p.pickup?.address?.split(',')[0]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {proposal.status === 'locked' && p.individual_fare && (
                  <span className="text-xs font-black text-emerald-600">₹{p.individual_fare}</span>
                )}
                {isOrganiser && proposal.status === 'open' && p.user_id !== user?.id && (
                  <button onClick={() => handleAction('Participant removed.', actions.kickParticipant, proposal.id, p.user_id)}
                    className="text-gray-300 hover:text-red-400 transition-colors">
                    <FontAwesomeIcon icon={faUserMinus} className="text-[10px]" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Join flow */}
        {proposal.status === 'open' && !myEntry && !isOrganiser && (
          <div className="mt-3">
            {joining ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-bold">Your pickup location:</p>
                <LocationAutocompleteOSM
                  placeholder="Enter your pickup"
                  onSelect={setPickup}
                  value={pickup?.address}
                  showCurrentLocation
                />
                <div className="flex gap-2">
                  <button onClick={handleJoin} disabled={!pickup || loading}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl disabled:opacity-50 flex items-center justify-center gap-1">
                    {loading ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : 'Confirm'}
                  </button>
                  <button onClick={() => { setJoining(false); setPickup(null); }}
                    className="px-3 py-2 bg-gray-100 text-gray-500 text-xs font-black rounded-xl">
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setJoining(true)}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-all">
                Join this ride
              </button>
            )}
          </div>
        )}

        {/* Leave */}
        {proposal.status === 'open' && myEntry && !isOrganiser && (
          <button onClick={() => handleAction('Left the ride proposal.', actions.leaveProposal, proposal.id)}
            className="mt-3 w-full py-2 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 text-xs font-black rounded-xl transition-all">
            Leave ride
          </button>
        )}

        {/* Organiser controls */}
        {isOrganiser && (
          <div className="mt-3 flex gap-2">
            {proposal.status === 'open' && confirmed.length > 0 && (
              <button onClick={() => handleAction('Route locked! ✅', actions.lockProposal, proposal.id)} disabled={loading}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1 disabled:opacity-50">
                <FontAwesomeIcon icon={faLock} /> Lock Route
              </button>
            )}
            {proposal.status === 'locked' && (
              <button onClick={() => handleAction('Dispatch sent to drivers! 🚀', actions.dispatchProposal, proposal.id)} disabled={loading}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1 disabled:opacity-50">
                <FontAwesomeIcon icon={faRocket} /> Dispatch
              </button>
            )}
            {['open', 'locked'].includes(proposal.status) && (
              <button onClick={() => handleAction('Proposal cancelled.', actions.cancelProposal, proposal.id)} disabled={loading}
                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 text-xs font-black rounded-xl">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>
        )}

        {/* Searching state */}
        {proposal.status === 'searching' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-violet-600 font-bold">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            Finding a driver...
          </div>
        )}

        {/* Route summary for locked */}
        {proposal.status === 'locked' && proposal.route_plan && (
          <div className="mt-3 p-2 bg-amber-50 rounded-xl">
            <div className="flex items-center gap-1 text-[10px] text-amber-700 font-black mb-1">
              <FontAwesomeIcon icon={faRoute} /> Route planned
            </div>
            <div className="text-[10px] text-amber-600">
              {proposal.route_plan.total_distance_km} km · ~{proposal.route_plan.total_duration_minutes} min
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RideProposalCard;
