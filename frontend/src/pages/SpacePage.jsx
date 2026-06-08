import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSpinner, faUsers, faBars, faCarSide } from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';

import { useAuth } from '../context/AuthContext';
import SpaceSidebar from '../components/space/SpaceSidebar';
import ChannelView from '../components/space/ChannelView';
import VoiceBar from '../components/space/VoiceBar';
import useChannel from '../hooks/useChannel';
import useVoice from '../hooks/useVoice';
import useRideProposal from '../hooks/useRideProposal';
import api from '../api/axios';

// Stable socket — created once per page mount
const useSpaceSocket = () => {
  const [socket, setSocket] = useState(null);
  const [ready,  setReady]  = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
    });
    s.on('connect',    () => { setReady(true);  setSocket(s); });
    s.on('disconnect', () => setReady(false));
    return () => { s.disconnect(); setSocket(null); };
  }, []);

  return { socket, ready };
};

// ── Inner component: rendered once socket + space are loaded ─────────────────

const SpaceInner = ({ space, initialChannels, user, socket, socketReady }) => {
  const [channels,      setChannels]      = useState(initialChannels);
  const [activeChannel, setActiveChannel] = useState(initialChannels[0] || null);
  const [voiceChannel,  setVoiceChannel]  = useState(null);
  const [members,       setMembers]       = useState([]);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);

  // Load community members for the members panel
  useEffect(() => {
    api.get('/community/members')
      .then(r => setMembers(r.data || []))
      .catch(() => {});
  }, []);

  const channelHook  = useChannel(activeChannel?.id, socket);
  const proposalHook = useRideProposal(activeChannel?.id, socket);
  const voiceHook    = useVoice(voiceChannel?.id || activeChannel?.id, user, socket);

  // Keep channel list fresh via socket (new channel created by someone else)
  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      api.get(`/spaces/${space.id}/channels`)
        .then(r => setChannels(r.data))
        .catch(() => {});
    };
    socket.on('channel_created', refresh);
    socket.on('channel_deleted', refresh);
    return () => {
      socket.off('channel_created', refresh);
      socket.off('channel_deleted', refresh);
    };
  }, [socket, space.id]);

  const handleSelectChannel = (ch, asVoice = false) => {
    if (asVoice) {
      setVoiceChannel(ch);
      voiceHook.joinVoice();
    } else {
      setActiveChannel(ch);
    }
  };

  // Shape members with online status (members in voice get online badge)
  const onlineMembers = voiceHook.inCall ? voiceHook.participants : [];
  const membersWithStatus = members.map(m => ({
    ...m,
    user_id: m.id,
    online:  onlineMembers.some(p => p.user_id === m.id),
  }));

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 61px)' }}>
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — hidden on mobile when collapsed */}
        {sidebarOpen && (
          <SpaceSidebar
            space={space}
            channels={channels}
            activeChannelId={activeChannel?.id}
            voiceChannelId={voiceChannel?.id}
            onSelectChannel={handleSelectChannel}
            user={user}
            onlineMembers={onlineMembers}
            onToggle={() => setSidebarOpen(false)}
          />
        )}

        <ChannelView
          channel={activeChannel}
          user={user}
          channelHook={channelHook}
          proposalHook={proposalHook}
          spaceMembers={membersWithStatus}
          socketReady={socketReady}
          onOpenSidebar={() => setSidebarOpen(true)}
          sidebarOpen={sidebarOpen}
        />
      </div>

      {voiceHook.inCall && voiceChannel && (
        <VoiceBar
          channelName={voiceChannel.name}
          participants={voiceHook.participants}
          localUserId={user.id}
          muted={voiceHook.muted}
          onToggleMute={voiceHook.toggleMute}
          onLeave={() => { voiceHook.leaveVoice(); setVoiceChannel(null); }}
        />
      )}

      {/* Mobile sidebar toggle (floating button when collapsed) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed bottom-20 left-4 z-40 w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-full flex items-center justify-center shadow-lg transition-all"
        >
          <FontAwesomeIcon icon={faBars} className="text-sm" />
        </button>
      )}
    </div>
  );
};

// ── Page shell ───────────────────────────────────────────────────────────────

const SpacePage = () => {
  const { user } = useAuth();
  const { socket, ready } = useSpaceSocket();
  const [space,    setSpace]    = useState(null);
  const [channels, setChannels] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    api.get('/spaces/my')
      .then(r => {
        setSpace(r.data);
        setChannels(r.data.channels || []);
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load space'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar — matches the app's main navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm flex-shrink-0" style={{ height: 61 }}>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 gradient-green rounded-xl flex items-center justify-center shadow-md">
            <FontAwesomeIcon icon={faUsers} className="text-white text-sm" />
          </div>
          <div>
            <span className="text-xl font-black text-gray-900 tracking-tight">
              {space?.name || 'Community Space'}
            </span>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-[10px] text-gray-400 font-bold">{ready ? 'Live' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/community"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
          >
            <FontAwesomeIcon icon={faUsers} className="text-xs" />
            Community
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-600 transition-all"
          >
            <FontAwesomeIcon icon={faArrowLeft} /> Home
          </Link>
        </div>
      </nav>

      {/* Offline reconnect banner */}
      {!ready && space && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-5 py-2.5 flex items-center justify-between text-xs font-semibold animate-fade-in flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
            <span>⚠️ Connection lost. Trying to reconnect...</span>
          </div>
          <button
            onClick={() => { if (socket) socket.connect(); }}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-white font-bold rounded-lg"
          >
            Reconnect
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 gradient-green rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FontAwesomeIcon icon={faCarSide} className="text-white text-2xl animate-pulse" />
            </div>
            <p className="text-gray-500 font-bold">Loading your space...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon icon={faUsers} className="text-3xl text-gray-400" />
            </div>
            <p className="text-gray-700 font-black text-lg mb-1">No Space Found</p>
            <p className="text-gray-400 text-sm mb-4">Communities are auto-assigned by your email domain</p>
            <Link to="/community"
              className="inline-flex items-center gap-2 px-5 py-2.5 gradient-green text-white rounded-xl text-sm font-bold transition-all shadow-md hover:opacity-90">
              <FontAwesomeIcon icon={faUsers} /> View Community
            </Link>
          </div>
        </div>
      ) : space && socket ? (
        <SpaceInner
          space={space}
          initialChannels={channels}
          user={user}
          socket={socket}
          socketReady={ready}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-emerald-500 text-3xl" />
        </div>
      )}
    </div>
  );
};

export default SpacePage;
