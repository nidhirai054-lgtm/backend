import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const useRideProposal = (channelId, socket) => {
  const [proposals, setProposals] = useState({});  // keyed by proposal id

  const upsert = useCallback((p) => {
    setProposals(prev => ({ ...prev, [p.id]: p }));
  }, []);

  // Listen for all proposal socket events on this channel
  useEffect(() => {
    if (!socket || !channelId) return;

    const onCreated    = (p)    => upsert(p);
    const onJoined     = ({ proposal_id, participant }) =>
      setProposals(prev => {
        const p = prev[proposal_id];
        if (!p) return prev;
        const already = p.participants.find(x => x.user_id === participant.user_id);
        return { ...prev, [proposal_id]: { ...p, participants: already ? p.participants : [...p.participants, participant] } };
      });
    const onLeft       = ({ proposal_id, user_id }) =>
      setProposals(prev => {
        const p = prev[proposal_id];
        if (!p) return prev;
        return { ...prev, [proposal_id]: { ...p, participants: p.participants.filter(x => x.user_id !== user_id) } };
      });
    const onKicked     = ({ proposal_id, user_id }) =>
      setProposals(prev => {
        const p = prev[proposal_id];
        if (!p) return prev;
        return { ...prev, [proposal_id]: { ...p, participants: p.participants.map(x => x.user_id === user_id ? { ...x, status: 'kicked' } : x) } };
      });
    const onLocked     = ({ proposal_id, route_plan }) =>
      setProposals(prev => {
        const p = prev[proposal_id];
        if (!p) return prev;
        return { ...prev, [proposal_id]: { ...p, status: 'locked', route_plan } };
      });
    const onDispatched = ({ proposal_id, ride_id }) =>
      setProposals(prev => {
        const p = prev[proposal_id];
        if (!p) return prev;
        return { ...prev, [proposal_id]: { ...p, status: 'searching', ride_id } };
      });
    const onCancelled  = ({ proposal_id }) =>
      setProposals(prev => {
        const p = prev[proposal_id];
        if (!p) return prev;
        return { ...prev, [proposal_id]: { ...p, status: 'cancelled' } };
      });

    socket.on('proposal_created',    onCreated);
    socket.on('proposal_joined',     onJoined);
    socket.on('proposal_left',       onLeft);
    socket.on('participant_kicked',  onKicked);
    socket.on('proposal_locked',     onLocked);
    socket.on('proposal_dispatched', onDispatched);
    socket.on('proposal_cancelled',  onCancelled);

    return () => {
      socket.off('proposal_created',    onCreated);
      socket.off('proposal_joined',     onJoined);
      socket.off('proposal_left',       onLeft);
      socket.off('participant_kicked',  onKicked);
      socket.off('proposal_locked',     onLocked);
      socket.off('proposal_dispatched', onDispatched);
      socket.off('proposal_cancelled',  onCancelled);
    };
  }, [socket, channelId, upsert]);

  const fetchProposal = useCallback(async (proposalId) => {
    if (!proposalId) return;
    try {
      const r = await api.get(`/proposals/${proposalId}`);
      upsert(r.data);
    } catch (_) {}
  }, [upsert]);

  const createProposal = useCallback(async (payload) => {
    const r = await api.post('/proposals/', payload);
    upsert(r.data);
    return r.data;
  }, [upsert]);

  const joinProposal = useCallback(async (proposalId, pickup) => {
    const r = await api.post(`/proposals/${proposalId}/join`, { pickup });
    return r.data;
  }, []);

  const leaveProposal = useCallback(async (proposalId) => {
    await api.post(`/proposals/${proposalId}/leave`);
  }, []);

  const kickParticipant = useCallback(async (proposalId, userId) => {
    await api.post(`/proposals/${proposalId}/kick/${userId}`);
  }, []);

  const lockProposal = useCallback(async (proposalId) => {
    const r = await api.post(`/proposals/${proposalId}/lock`);
    upsert(r.data);
    return r.data;
  }, [upsert]);

  const dispatchProposal = useCallback(async (proposalId) => {
    const r = await api.post(`/proposals/${proposalId}/dispatch`);
    return r.data;
  }, []);

  const cancelProposal = useCallback(async (proposalId) => {
    await api.post(`/proposals/${proposalId}/cancel`);
  }, []);

  return {
    proposals,
    fetchProposal,
    createProposal,
    joinProposal,
    leaveProposal,
    kickParticipant,
    lockProposal,
    dispatchProposal,
    cancelProposal,
  };
};

export default useRideProposal;
