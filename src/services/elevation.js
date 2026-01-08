/**
 * Elevation service using Open-Meteo Elevation API
 * Has proper CORS support for browser requests
 *
 * API: https://api.open-meteo.com/v1/elevation?latitude=lat1,lat2&longitude=lng1,lng2
 *
 * Returns elevation in meters for each coordinate pair
 * Free tier: 10,000 requests/day, no API key needed
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/elevation'

/**
 * Fetch elevation data for a list of coordinates
 * @param {Array} coordinates - Array of [lng, lat] pairs (GeoJSON format)
 * @returns {Promise<Array>} - Array of { lat, lng, elevation, distance }
 */
export async function fetchElevationProfile(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    console.warn('[Elevation] No coordinates provided')
    return []
  }

  // Sample coordinates - Open-Meteo has URL length limits, keep under 50 points
  const maxPoints = 50
  const step = Math.max(1, Math.floor(coordinates.length / maxPoints))
  const sampledCoords = []

  // Always include first and last point
  for (let i = 0; i < coordinates.length; i += step) {
    sampledCoords.push(coordinates[i])
  }
  // Ensure last point is included
  if (sampledCoords[sampledCoords.length - 1] !== coordinates[coordinates.length - 1]) {
    sampledCoords.push(coordinates[coordinates.length - 1])
  }

  console.log('[Elevation] Fetching elevation for', sampledCoords.length, 'points from', coordinates.length, 'total')

  try {
    // Open-Meteo expects: ?latitude=lat1,lat2,...&longitude=lng1,lng2,...
    const latitudes = sampledCoords.map(c => c[1].toFixed(6)).join(',')
    const longitudes = sampledCoords.map(c => c[0].toFixed(6)).join(',')

    const url = `${OPEN_METEO_URL}?latitude=${latitudes}&longitude=${longitudes}`
    console.log('[Elevation] Fetching from Open-Meteo...')

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('[Elevation] Response received, elevations:', data.elevation?.length || 0)

    // Open-Meteo returns { elevation: [e1, e2, ...] }
    if (!data.elevation || !Array.isArray(data.elevation)) {
      throw new Error('Invalid response format')
    }

    // Build profile with cumulative distance
    let cumulativeDistance = 0
    const profile = []

    for (let i = 0; i < sampledCoords.length; i++) {
      const [lng, lat] = sampledCoords[i]
      const elevation = data.elevation[i]

      // Calculate distance from previous point
      if (i > 0) {
        const [prevLng, prevLat] = sampledCoords[i - 1]
        cumulativeDistance += haversineDistance(prevLat, prevLng, lat, lng)
      }

      profile.push({
        lat,
        lng,
        elevation: typeof elevation === 'number' && !isNaN(elevation) ? elevation : null,
        distance: cumulativeDistance,
      })
    }

    const validCount = profile.filter(p => p.elevation !== null).length
    console.log('[Elevation] Got', profile.length, 'points,', validCount, 'with valid elevation')

    return profile

  } catch (err) {
    console.error('[Elevation] Open-Meteo failed:', err.message)
    return generateFallbackProfile(sampledCoords)
  }
}

/**
 * Generate a fallback profile when API fails (with null elevations)
 */
function generateFallbackProfile(sampledCoords) {
  let cumulativeDistance = 0
  return sampledCoords.map((coord, index, arr) => {
    if (index > 0) {
      const prev = arr[index - 1]
      cumulativeDistance += haversineDistance(prev[1], prev[0], coord[1], coord[0])
    }
    return {
      lat: coord[1],
      lng: coord[0],
      elevation: null,
      distance: cumulativeDistance,
    }
  })
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Earth radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg) {
  return deg * (Math.PI / 180)
}

/**
 * Calculate elevation gain and loss from profile
 * @param {Array} profile - Elevation profile array
 * @returns {Object} - { gain, loss, max, min }
 */
export function calculateElevationStats(profile) {
  if (!profile || profile.length === 0) {
    return { gain: 0, loss: 0, max: 0, min: 0 }
  }

  // Filter valid points first
  const validPoints = profile.filter(p => p.elevation !== null)

  if (validPoints.length === 0) {
    return { gain: 0, loss: 0, max: 0, min: 0 }
  }

  let gain = 0
  let loss = 0
  let max = validPoints[0].elevation
  let min = validPoints[0].elevation

  for (let i = 1; i < validPoints.length; i++) {
    const curr = validPoints[i].elevation
    const prev = validPoints[i - 1].elevation

    const diff = curr - prev
    if (diff > 0) gain += diff
    else loss += Math.abs(diff)

    if (curr > max) max = curr
    if (curr < min) min = curr
  }

  return {
    gain: Math.round(gain),
    loss: Math.round(loss),
    max: Math.round(max),
    min: Math.round(min),
  }
}
