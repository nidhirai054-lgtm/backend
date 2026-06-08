import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

const useChannel = (channelId, socket) => {
  const [messages,      setMessages]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [hasMore,       setHasMore]       = useState(true);
  const [typingUsers,   setTypingUsers]   = useState([]);
  const typingTimer = useRef(null);

  // Join channel socket room
  useEffect(() => {
    if (!channelId || !socket) return;
    socket.emit('join_channel', { channel_id: channelId });
    return () => socket.emit('leave_channel', { channel_id: channelId });
  }, [channelId, socket]);

  // Load initial messages
  useEffect(() => {
    if (!channelId) return;
    setMessages([]);
    setHasMore(true);
    setLoading(true);
    api.get(`/channels/${channelId}/messages?limit=40`)
      .then(r => {
        setMessages(r.data);
        setHasMore(r.data.length === 40);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channelId]);

  // Real-time incoming messages
  useEffect(() => {
    if (!socket || !channelId) return;
    const handler = (msg) => {
      if (msg.channel_id !== channelId) return;
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };
    const deleteHandler = ({ message_id }) => {
      setMessages(prev => prev.map(m => m.id === message_id ? { ...m, deleted: true, content: '' } : m));
    };
    const typingHandler = ({ user_id, name, typing }) => {
      setTypingUsers(prev =>
        typing
          ? prev.find(u => u.user_id === user_id) ? prev : [...prev, { user_id, name }]
          : prev.filter(u => u.user_id !== user_id)
      );
    };
    socket.on('new_message',     handler);
    socket.on('message_deleted', deleteHandler);
    socket.on('user_typing',     typingHandler);
    return () => {
      socket.off('new_message',     handler);
      socket.off('message_deleted', deleteHandler);
      socket.off('user_typing',     typingHandler);
    };
  }, [socket, channelId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !messages.length) return;
    setLoading(true);
    try {
      const oldest = messages[0]?.id;
      const r = await api.get(`/channels/${channelId}/messages?limit=40&before=${oldest}`);
      setMessages(prev => [...r.data, ...prev]);
      setHasMore(r.data.length === 40);
    } catch {}
    finally { setLoading(false); }
  }, [channelId, messages, hasMore, loading]);

  const sendMessage = useCallback(async (content) => {
    if (!content.trim()) return;
    try {
      await api.post(`/channels/${channelId}/messages`, { content });
    } catch {
      throw new Error('Failed to send message. Please try again.');
    }
  }, [channelId]);

  const emitTyping = useCallback((user, isTyping) => {
    if (!socket || !channelId) return;
    if (isTyping) {
      socket.emit('typing_start', { channel_id: channelId, user_id: user.id, name: user.name });
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        socket.emit('typing_stop', { channel_id: channelId, user_id: user.id });
      }, 2000);
    } else {
      socket.emit('typing_stop', { channel_id: channelId, user_id: user.id });
    }
  }, [socket, channelId]);

  const deleteMessage = useCallback(async (messageId) => {
    await api.delete(`/channels/${channelId}/messages/${messageId}`);
  }, [channelId]);

  return { messages, loading, hasMore, typingUsers, loadMore, sendMessage, emitTyping, deleteMessage };
};

export default useChannel;
