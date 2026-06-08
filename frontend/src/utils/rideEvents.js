// Simple event emitter for global ride state synchronization
class RideEventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }
}

export const rideEvents = new RideEventEmitter();

// Event types
export const RIDE_EVENTS = {
  RIDE_BOOKED: 'ride:booked',
  RIDE_UPDATED: 'ride:updated',
  RIDE_CANCELLED: 'ride:cancelled',
};
