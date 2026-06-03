/**
 * Free routing service using OSRM (Open Source Routing Machine)
 * No API key required
 */

const OSRM_SERVER = 'https://router.project-osrm.org';

/**
 * Get route between two points using OSRM
 * @param {Object} pickup - {lat, lng}
 * @param {Object} dropoff - {lat, lng}
 * @returns {Promise<Object>} Route data with coordinates, distance, duration
 */
export const getRoute = async (pickup, dropoff) => {
  try {
    const url = `${OSRM_SERVER}/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson&steps=true`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }
    
    const route = data.routes[0];
    
    return {
      coordinates: route.geometry.coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      })),
      distance: route.distance, // meters
      duration: route.duration, // seconds
      distanceText: `${(route.distance / 1000).toFixed(1)} km`,
      durationText: `${Math.round(route.duration / 60)} min`
    };
  } catch (error) {
    console.error('OSRM routing error:', error);
    
    // Fallback: return straight line
    return {
      coordinates: [
        { lat: pickup.lat, lng: pickup.lng },
        { lat: dropoff.lat, lng: dropoff.lng }
      ],
      distance: null,
      duration: null,
      distanceText: 'N/A',
      durationText: 'N/A'
    };
  }
};

/**
 * Get nearest point on route to current location
 * @param {Object} currentLocation - {lat, lng}
 * @param {Array} routeCoordinates - Array of {lat, lng}
 * @returns {number} Index of nearest point
 */
export const getNearestPointOnRoute = (currentLocation, routeCoordinates) => {
  let minDistance = Infinity;
  let nearestIndex = 0;
  
  routeCoordinates.forEach((point, index) => {
    const distance = Math.sqrt(
      Math.pow(point.lat - currentLocation.lat, 2) +
      Math.pow(point.lng - currentLocation.lng, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = index;
    }
  });
  
  return nearestIndex;
};

/**
 * Get next waypoint on route for smooth animation
 * @param {Object} currentLocation - {lat, lng}
 * @param {Array} routeCoordinates - Array of {lat, lng}
 * @param {number} currentIndex - Current position on route
 * @returns {Object} Next waypoint {lat, lng}
 */
export const getNextWaypoint = (currentLocation, routeCoordinates, currentIndex) => {
  // Return next point on route, or last point if at end
  const nextIndex = Math.min(currentIndex + 1, routeCoordinates.length - 1);
  return routeCoordinates[nextIndex];
};

/**
 * Calculate progress along route (0 to 1)
 * @param {Object} currentLocation - {lat, lng}
 * @param {Array} routeCoordinates - Array of {lat, lng}
 * @returns {number} Progress from 0 to 1
 */
export const calculateRouteProgress = (currentLocation, routeCoordinates) => {
  const nearestIndex = getNearestPointOnRoute(currentLocation, routeCoordinates);
  return nearestIndex / (routeCoordinates.length - 1);
};

export default {
  getRoute,
  getNearestPointOnRoute,
  getNextWaypoint,
  calculateRouteProgress
};
