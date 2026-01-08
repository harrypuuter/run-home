/**
 * Elevation service using Open-Meteo API (free, reliable, no API key required)
 * API docs: https://open-meteo.com/en/docs/elevation-api
 */

const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation'

/**
 * Fetch elevation data for a list of coordinates
 * @param {Array} coordinates - Array of [lng, lat] pairs (GeoJSON format)
 * @returns {Promise<Array>} - Array of { lat, lng, elevation, distance }
 */
export async function fetchElevationProfile(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return []
  }

  // Sample coordinates - Open-Meteo can handle many points but we'll keep it reasonable
  const maxPoints = Math.min(100, coordinates.length)
  const step = Math.max(1, Math.floor(coordinates.length / maxPoints))
  const sampledCoords = coordinates.filter((_, i) => i % step === 0)

  try {
    const profile = await fetchOpenMeteoElevation(sampledCoords)

    if (!profile || profile.length === 0) {
      return generateFallbackProfile(sampledCoords)
    }

    return profile
  } catch (err) {
    console.error('[Elevation] API failed:', err.message)
    return generateFallbackProfile(sampledCoords)
  }
}

/**
 * Fetch elevation from Open-Meteo API
 * Uses GET request with comma-separated lat/lng values
 */
async function fetchOpenMeteoElevation(sampledCoords) {
  // Open-Meteo expects latitude and longitude as comma-separated values
  const latitudes = sampledCoords.map(([lng, lat]) => lat).join(',')
  const longitudes = sampledCoords.map(([lng, lat]) => lng).join(',')

  const url = `${OPEN_METEO_ELEVATION_URL}?latitude=${latitudes}&longitude=${longitudes}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Open-Meteo API failed: ${response.status}`)
  }

  const data = await response.json()

  if (!data.elevation || !Array.isArray(data.elevation)) {
    throw new Error('Invalid response from Open-Meteo')
  }

  // Build profile with cumulative distance
  let cumulativeDistance = 0
  const profile = data.elevation.map((elevation, index) => {
    if (index > 0) {
      const prev = sampledCoords[index - 1]
      const curr = sampledCoords[index]
      cumulativeDistance += calculateHaversineDistance(
        prev[1], prev[0],
        curr[1], curr[0]
      )
    }

    const [lng, lat] = sampledCoords[index]
    return {
      lat,
      lng,
      elevation,
      distance: cumulativeDistance,
    }
  })

  return profile
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
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

function toRad(degrees) {
  return (degrees * Math.PI) / 180
}

/**
 * Generate a fallback profile when API fails (with null elevations)
 */
function generateFallbackProfile(sampledCoords) {
  let cumulativeDistance = 0
  return sampledCoords.map((coord, index, arr) => {
    if (index > 0) {
      const prev = arr[index - 1]
      cumulativeDistance += calculateHaversineDistance(
        prev[1], prev[0],
        coord[1], coord[0]
      )
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
 * Calculate elevation gain and loss from profile
 * @param {Array} profile - Elevation profile array
 * @returns {Object} - { gain, loss, max, min }
 */
export function calculateElevationStats(profile) {
  if (!profile || profile.length === 0) {
    return { gain: 0, loss: 0, max: 0, min: 0 }
  }

  let gain = 0
  let loss = 0
  let max = profile[0]?.elevation ?? 0
  let min = profile[0]?.elevation ?? 0

  for (let i = 1; i < profile.length; i++) {
    const curr = profile[i].elevation
    const prev = profile[i - 1].elevation

    if (curr !== null && prev !== null) {
      const diff = curr - prev
      if (diff > 0) gain += diff
      else loss += Math.abs(diff)

      if (curr > max) max = curr
      if (curr < min) min = curr
    }
  }

  return {
    gain: Math.round(gain),
    loss: Math.round(loss),
    max: Math.round(max),
    min: Math.round(min),
  }
}
