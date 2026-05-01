/**
 * Haversine formula to calculate the great-circle distance between two points on a sphere.
 * Returns distance in METERS.
 * 
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const a1 = Number(lat1);
  const o1 = Number(lon1);
  const a2 = Number(lat2);
  const o2 = Number(lon2);
  if (![a1, o1, a2, o2].every(Number.isFinite)) return Infinity;
  
  const R = 6371e3; // Earth radius in meters
  const φ1 = (a1 * Math.PI) / 180;
  const φ2 = (a2 * Math.PI) / 180;
  const Δφ = ((a2 - a1) * Math.PI) / 180;
  const Δλ = ((o2 - o1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
