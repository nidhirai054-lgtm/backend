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

  /**
   * Join a named socket.io room by emitting a join event.
   * Convenience wrapper so components don't have to know the event name.
   *
   * @param {'passenger' | 'admin' | 'ride'} roomType
   * @param {string} id  — user_id for 'passenger', ride_id for 'ride'
   *
   * Examples:
   *   joinRoom('passenger', user.id)   → emit('join_passenger_room', {user_id})
   *   joinRoom('admin')                → emit('join_admin_room', {})
   *   joinRoom('ride', ride.id)        → emit('join_ride_room', {ride_id})
   */
  const joinRoom = useCallback((roomType, id) => {
    if (!socketRef.current) return;
    switch (roomType) {
      case 'passenger':
        socketRef.current.emit('join_passenger_room', { user_id: id });
        break;
      case 'admin':
        socketRef.current.emit('join_admin_room', {});
        break;
      case 'ride':
        socketRef.current.emit('join_ride_room', { ride_id: id });
        break;
      default:
        console.warn(`[useSocket] Unknown roomType: ${roomType}`);
    }
  }, []);

  return { isConnected, emit, on, off, joinRoom };
};

export default useSocket;
