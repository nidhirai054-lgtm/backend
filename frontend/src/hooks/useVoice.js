import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const useVoice = (channelId, user, socket) => {
  const [participants, setParticipants] = useState([]);  // [{user_id, name, muted, stream}]
  const [localStream,  setLocalStream]  = useState(null);
  const [muted,        setMuted]        = useState(false);
  const [inCall,       setInCall]       = useState(false);
  const peers = useRef({});  // {user_id: RTCPeerConnection}
  const localStreamRef = useRef(null);

  const createPeer = useCallback((remoteUserId, initiator) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('voice_ice_candidate', {
          channel_id:  channelId,
          from_user_id: user.id,
          to_user_id:  remoteUserId,
          candidate,
        });
      }
    };

    // Remote stream
    pc.ontrack = ({ streams }) => {
      setParticipants(prev => prev.map(p =>
        p.user_id === remoteUserId ? { ...p, stream: streams[0] } : p
      ));
    };

    peers.current[remoteUserId] = pc;

    if (initiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => socket.emit('voice_offer', {
          channel_id:   channelId,
          from_user_id: user.id,
          to_user_id:   remoteUserId,
          sdp:          pc.localDescription,
        }));
    }

    return pc;
  }, [channelId, user, socket]);

  const joinVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setInCall(true);
      socket.emit('join_voice', { channel_id: channelId, user_id: user.id, name: user.name });
    } catch {
      console.error('Microphone access denied');
    }
  }, [channelId, user, socket]);

  const leaveVoice = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    Object.values(peers.current).forEach(pc => pc.close());
    peers.current = {};
    setParticipants([]);
    setInCall(false);
    socket.emit('leave_voice', { channel_id: channelId, user_id: user.id });
  }, [channelId, user, socket]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMuted = !muted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setMuted(newMuted);
    socket.emit('voice_mute_toggle', { channel_id: channelId, user_id: user.id, muted: newMuted });
  }, [muted, channelId, user, socket]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !channelId) return;

    const onUserJoined = ({ user_id, name }) => {
      setParticipants(prev => prev.find(p => p.user_id === user_id) ? prev : [...prev, { user_id, name, muted: false, stream: null }]);
      // Initiate offer to new joiner if we're already in the call
      if (inCall && user_id !== user.id) {
        createPeer(user_id, true);
      }
    };

    const onUserLeft = ({ user_id }) => {
      peers.current[user_id]?.close();
      delete peers.current[user_id];
      setParticipants(prev => prev.filter(p => p.user_id !== user_id));
    };

    const onSignal = async ({ from_user_id, type, sdp, candidate }) => {
      if (type === 'offer') {
        const pc = createPeer(from_user_id, false);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice_answer', {
          channel_id:   channelId,
          from_user_id: user.id,
          to_user_id:   from_user_id,
          sdp:          pc.localDescription,
        });
      } else if (type === 'answer') {
        await peers.current[from_user_id]?.setRemoteDescription(new RTCSessionDescription(sdp));
      } else if (type === 'ice_candidate') {
        await peers.current[from_user_id]?.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const onMuteChanged = ({ user_id, muted: m }) => {
      setParticipants(prev => prev.map(p => p.user_id === user_id ? { ...p, muted: m } : p));
    };

    socket.on('voice_user_joined', onUserJoined);
    socket.on('voice_user_left',   onUserLeft);
    socket.on('voice_signal',      onSignal);
    socket.on('voice_mute_changed', onMuteChanged);

    return () => {
      socket.off('voice_user_joined', onUserJoined);
      socket.off('voice_user_left',   onUserLeft);
      socket.off('voice_signal',      onSignal);
      socket.off('voice_mute_changed', onMuteChanged);
    };
  }, [socket, channelId, inCall, user, createPeer]);

  return { participants, localStream, muted, inCall, joinVoice, leaveVoice, toggleMute };
};

export default useVoice;
