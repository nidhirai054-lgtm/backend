import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHashtag, faPaperPlane, faCar, faSpinner,
  faBolt, faCarSide, faUsers, faChevronUp, faXmark, faBars,
} from '@fortawesome/free-solid-svg-icons';
import MessageBubble from './MessageBubble';
import LocationAutocompleteOSM from '../LocationAutocompleteOSM';
import api from '../../api/axios';

// ── Proposal creation modal ──────────────────────────────────────────────────

const ProposalModal = ({ channel, onCreated, onClose }) => {
  const [destination, setDestination] = useState(null);
  const [time,        setTime]        = useState('');
  const [rideType,    setRideType]    = useState('pooled');
  const [seats,       setSeats]       = useState(4);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destination || !time) return;
    setLoading(true);
    setError('');
    try {
      await onCreated({
        channel_id:       channel.id,
        destination,
        proposed_time:    new Date(time).toISOString(),
        ride_type:        rideType,
        max_participants: seats,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-2xl animate-fade-in-up border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-black text-gray-900 text-lg">New Ride Proposal</h3>
            <p className="text-xs text-gray-400 mt-0.5">Invite your community to share a ride</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-all">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {error && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Destination</p>
            <LocationAutocompleteOSM
              placeholder="Where are you all going?"
              onSelect={setDestination}
              value={destination?.address}
              showCurrentLocation={false}
            />
          </div>

          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Proposed Time</p>
            <input
              type="datetime-local" value={time}
              onChange={e => setTime(e.target.value)} required
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-emerald-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Ride Type</p>
              <div className="flex gap-2">
                {[['pooled', faCarSide, 'Pooled'], ['EV', faBolt, 'EV']].map(([key, icon, label]) => (
                  <button key={key} type="button" onClick={() => setRideType(key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-black transition-all ${
                      rideType === key ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <FontAwesomeIcon icon={icon} />{label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Max Seats</p>
              <input
                type="number" min={2} max={8} value={seats}
                onChange={e => setSeats(Number(e.target.value))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl text-sm transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading || !destination || !time}
              className="flex-1 py-3 gradient-green text-white font-black rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-md">
              {loading ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : <FontAwesomeIcon icon={faCar} />}
              Propose Ride
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Members panel ────────────────────────────────────────────────────────────

const MembersPanel = ({ members, onClose }) => (
  <div className="w-56 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col h-full shadow-sm">
    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
      <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Members — {members.length}</span>
      <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all">
        <FontAwesomeIcon icon={faXmark} className="text-xs" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
      {members.length === 0 && (
        <p className="text-xs text-gray-400 px-2 py-4 text-center">No members loaded</p>
      )}
      {members.map(m => (
        <div key={m.user_id || m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors">
          <div className="relative flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-black">
              {m.name?.[0]?.toUpperCase()}
            </div>
            {m.online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-800 font-semibold truncate">{m.name}</p>
            <p className="text-[10px] text-gray-400 capitalize truncate">{m.role}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── ChannelView ──────────────────────────────────────────────────────────────

const ChannelView = ({ channel, user, channelHook, proposalHook, spaceMembers = [], socketReady = true, onOpenSidebar, sidebarOpen }) => {
  const {
    messages, loading, hasMore, typingUsers,
    loadMore, sendMessage, emitTyping, deleteMessage,
  } = channelHook;
  const {
    proposals, createProposal, joinProposal, leaveProposal,
    kickParticipant, lockProposal, dispatchProposal, cancelProposal, fetchProposal,
  } = proposalHook;

  const [text,        setText]        = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sendError,   setSendError]   = useState('');
  const bottomRef  = useRef(null);
  const listRef    = useRef(null);
  const isAtBottom = useRef(true);

  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Reset scroll position when channel changes
  useEffect(() => {
    isAtBottom.current = true;
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
  }, [channel?.id]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    await loadMore();
    setLoadingMore(false);
  }, [loadMore]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    setSendError('');
    emitTyping(user, false);
    try {
      await sendMessage(content);
    } catch (err) {
      setSendError(err.message || 'Failed to send');
      setText(content); // restore so user can retry
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleInput = (e) => {
    setText(e.target.value);
    emitTyping(user, true);
  };

  const handleDelete = useCallback((messageId) => {
    deleteMessage?.(messageId);
  }, [deleteMessage]);

  const proposalActions = {
    joinProposal, leaveProposal, kickParticipant,
    lockProposal, dispatchProposal, cancelProposal,
  };

  // Group consecutive messages from the same sender (within 5 min)
  const groupedMessages = messages.map((msg, i) => {
    if (i === 0) return { ...msg, grouped: false };
    const prev = messages[i - 1];
    const sameUser = prev.sender_id === msg.sender_id;
    const sameType = msg.message_type === 'text' && prev.message_type === 'text';
    const closeInTime = new Date(msg.created_at) - new Date(prev.created_at) < 5 * 60 * 1000;
    return { ...msg, grouped: sameUser && sameType && closeInTime };
  });

  if (!channel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 gap-4">
        {!sidebarOpen && (
          <button
            onClick={onOpenSidebar}
            className="absolute top-4 left-4 w-9 h-9 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all shadow-sm"
          >
            <FontAwesomeIcon icon={faBars} className="text-sm" />
          </button>
        )}
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
          <FontAwesomeIcon icon={faHashtag} className="text-3xl text-gray-300" />
        </div>
        <p className="text-gray-400 text-sm font-bold">Select a channel to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 min-w-0">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">

        {/* Channel header */}
        <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
          {/* Mobile sidebar toggle */}
          {!sidebarOpen && (
            <button
              onClick={onOpenSidebar}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 transition-all flex-shrink-0"
            >
              <FontAwesomeIcon icon={faBars} className="text-xs" />
            </button>
          )}
          <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <FontAwesomeIcon icon={faHashtag} className="text-emerald-600 text-xs" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-black text-gray-900 text-sm">{channel.name}</span>
            {channel.description && (
              <span className="text-xs text-gray-400 border-l border-gray-200 pl-3 ml-3">{channel.description}</span>
            )}
          </div>
          <button
            onClick={() => setShowMembers(v => !v)}
            title="Toggle members"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              showMembers
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faUsers} className="text-xs" />
            <span className="hidden sm:inline">{spaceMembers.length || ''}</span>
          </button>
        </div>

        {/* Messages */}
        <div ref={listRef} onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3 min-h-0 bg-gray-50/50">

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center py-3">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore || loading}
                className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 text-xs font-bold rounded-full transition-all disabled:opacity-50 shadow-sm"
              >
                {loadingMore
                  ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Loading...</>
                  : <><FontAwesomeIcon icon={faChevronUp} /> Load earlier messages</>
                }
              </button>
            </div>
          )}

          {loading && !loadingMore && (
            <div className="flex justify-center py-8">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-emerald-400 text-xl" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
              <div className="w-14 h-14 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-center justify-center">
                <FontAwesomeIcon icon={faHashtag} className="text-emerald-400 text-xl" />
              </div>
              <p className="text-gray-700 font-black text-sm">#{channel.name}</p>
              <p className="text-gray-400 text-xs">This is the beginning of this channel.</p>
            </div>
          )}

          {groupedMessages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              user={user}
              grouped={msg.grouped}
              proposal={msg.ride_proposal_id ? proposals[msg.ride_proposal_id] : null}
              proposalActions={proposalActions}
              onDelete={handleDelete}
              onFetchProposal={fetchProposal}
            />
          ))}
          <div ref={bottomRef} className="h-2" />
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="px-5 pb-1 text-[11px] text-gray-400 italic flex-shrink-0 flex items-center gap-1.5">
            <span className="flex gap-0.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            {typingUsers.map(u => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        {/* Disconnect banner */}
        {!socketReady && (
          <div className="bg-amber-50 border-t border-amber-200 text-amber-800 px-4 py-2 flex items-center gap-2 text-xs font-bold flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            Reconnecting... Messages may not be delivered.
          </div>
        )}

        {/* Send error */}
        {sendError && (
          <div className="bg-red-50 border-t border-red-200 px-5 py-2.5 flex items-center justify-between flex-shrink-0 animate-fade-in">
            <span className="text-xs text-red-600 font-bold">⚠️ {sendError}</span>
            <button onClick={() => setSendError('')} className="text-red-500 hover:text-red-700 text-xs font-bold ml-3 uppercase tracking-wide">Dismiss</button>
          </div>
        )}

        {/* Input bar */}
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button
              type="button" onClick={() => setShowModal(true)}
              title="Propose a group ride"
              disabled={!socketReady}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-all disabled:opacity-35 disabled:cursor-not-allowed border border-emerald-100"
            >
              <FontAwesomeIcon icon={faCar} className="text-sm" />
            </button>

            <input
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={!socketReady}
              placeholder={socketReady ? `Message #${channel.name}` : 'Connecting to server...'}
              className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-transparent focus:border-emerald-200"
            />

            <button
              type="submit" disabled={!text.trim() || !socketReady}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl gradient-green text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm hover:opacity-90"
            >
              <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
            </button>
          </form>
        </div>
      </div>

      {/* Members panel */}
      {showMembers && (
        <MembersPanel members={spaceMembers} onClose={() => setShowMembers(false)} />
      )}

      {showModal && (
        <ProposalModal
          channel={channel}
          onCreated={createProposal}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default ChannelView;
