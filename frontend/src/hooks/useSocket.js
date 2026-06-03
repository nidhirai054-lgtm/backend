import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const useSocket = (url) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    socketRef.current = io(url || 'http://localhost:5000', {
      auth: { token }
    });

    socketRef.current.on('connect', () => setIsConnected(true));
    socketRef.current.on('disconnect', () => setIsConnected(false));

    return () => {
      socketRef.current?.disconnect();
    };
  }, [url]);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event, callback) => {
    socketRef.current?.on(event, callback);
  }, []);

  const off = useCallback((event) => {
    socketRef.current?.off(event);
  }, []);

  return { isConnected, emit, on, off };
};

export default useSocket;
