/**
 * Convert degrees to radians
 */
export function toRad(degrees) {
  return (degrees * Math.PI) / 180
}

/**
 * Convert radians to degrees
 */
export function toDeg(radians) {
  return (radians * 180) / Math.PI
}

/**
 * Calculate bearing from point A to point B
 * @param {number} lat1 - Latitude of point A
 * @param {number} lng1 - Longitude of point A
 * @param {number} lat2 - Latitude of point B
 * @param {number} lng2 - Longitude of point B
 * @returns {number} - Bearing in degrees (0-360)
 */
export function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1)
  const lat1Rad = toRad(lat1)
  const lat2Rad = toRad(lat2)

  const y = Math.sin(dLng) * Math.cos(lat2Rad)
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns {number} - Distance in meters
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Check if a bearing falls within a direction
 * @param {number} bearing - Bearing in degrees
 * @param {string} direction - 'north', 'east', 'south', 'west', or 'any'
 * @returns {boolean}
 */
export function isInDirection(bearing, direction) {
  if (direction === 'any') return true

  const ranges = {
    north: [315, 45],
    east: [45, 135],
    south: [135, 225],
    west: [225, 315],
  }

  const [min, max] = ranges[direction] || [0, 360]

  if (min > max) {
    // Wraps around 360 (e.g., north: 315-45)
    return bearing >= min || bearing < max
  }

  return bearing >= min && bearing < max
}

/**
 * Filter stops by direction from home
 * @param {Array} stops - Array of transit stops
 * @param {number} homeLat - Home latitude
 * @param {number} homeLng - Home longitude
 * @param {string} direction - Direction to filter by
 * @returns {Array} - Filtered stops
 */
export function filterByDirection(stops, homeLat, homeLng, direction) {
  if (direction === 'any') return stops

  return stops.filter((stop) => {
    const bearing = calculateBearing(homeLat, homeLng, stop.lat, stop.lng)
    return isInDirection(bearing, direction)
  })
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} - Formatted distance
 */
export function formatDistance(meters) {
  if (typeof meters !== 'number' || !isFinite(meters)) return '--'
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !isFinite(seconds)) return '--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}min`
  }
  return `${minutes} min`
}

/**
 * Calculate distance tolerance based on target distance
 * Uses adaptive tolerance: starts at 10%, relaxes to 20%, then 30%
 * @param {number} targetKm - Target distance in km
 * @param {number} toleranceLevel - 0 = 10%, 1 = 20%, 2 = 30%
 * @returns {Object} - { min, max } in meters, tolerance percentage
 */
export function getDistanceTolerance(targetKm, toleranceLevel = 0) {
  const targetMeters = targetKm * 1000
  const tolerances = [0.10, 0.20, 0.30] // 10%, 20%, 30%
  const tolerance = tolerances[Math.min(toleranceLevel, tolerances.length - 1)]

  return {
    min: targetMeters * (1 - tolerance),
    max: targetMeters * (1 + tolerance),
    tolerance,
  }
}

/**
 * All tolerance levels for adaptive search
 */
export const TOLERANCE_LEVELS = [0, 1, 2] // 10%, 20%, 30%

/**
 * Calculate search annulus radii based on target distance
 * Inner radius: 50% of target distance
 * Outer radius: 100% of target distance
 * @param {number} targetKm - Target distance in km
 * @returns {Object} - { innerRadius, outerRadius } in meters
 */
export function getSearchRadii(targetKm) {
  const targetMeters = targetKm * 1000
  return {
    innerRadius: targetMeters * 0.5,
    outerRadius: targetMeters * 1.0,
  }
}
