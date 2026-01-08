/**
 * Elevation service using OpenTopoData API
 * Much more reliable than Open-Meteo for elevation data
 * 
 * API: https://api.opentopodata.org/v1/{dataset}?locations={lat},{lng}|{lat},{lng}
 * 
 * Available datasets:
 * - eudem25m: 25m resolution, Europe only
 * - srtm30m: 30m resolution, global (-60 to 60 latitude)
 * - mapzen: 30m resolution, global including bathymetry
 * - aster30m: 30m resolution, global
 * 
 * Limits: 100 locations per request, 1 call/second, 1000 calls/day
 */

const OPENTOPODATA_URL = 'https://api.opentopodata.org/v1'

// Datasets to try in order of preference (highest resolution first)
const DATASETS = ['eudem25m', 'srtm30m', 'mapzen']

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

  // Sample coordinates - API limit is 100 points per request
  const maxPoints = 80 // Leave some margin
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

  // Try each dataset until we get valid results
  for (const dataset of DATASETS) {
    try {
      const profile = await fetchFromOpenTopoData(sampledCoords, dataset)
      
      if (profile && profile.length > 0) {
        const validCount = profile.filter(p => p.elevation !== null).length
        console.log(`[Elevation] ${dataset}: Got ${profile.length} points, ${validCount} valid`)
        
        // If we got at least 50% valid data, use it
        if (validCount >= profile.length * 0.5) {
          return profile
        }
      }
    } catch (err) {
      console.warn(`[Elevation] ${dataset} failed:`, err.message)
    }
    
    // Rate limit: wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // All datasets failed, return profile with null elevations
  console.error('[Elevation] All datasets failed, returning empty profile')
  return generateFallbackProfile(sampledCoords)
}

/**
 * Fetch elevation from OpenTopoData API
 */
async function fetchFromOpenTopoData(sampledCoords, dataset) {
  // Format: lat,lng|lat,lng|...
  const locations = sampledCoords
    .map(([lng, lat]) => `${lat.toFixed(6)},${lng.toFixed(6)}`)
    .join('|')

  const url = `${OPENTOPODATA_URL}/${dataset}?locations=${locations}&interpolation=bilinear`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`)
  }

  const data = await response.json()

  if (data.status !== 'OK' || !data.results) {
    throw new Error(data.error || 'Invalid response')
  }

  // Build profile with cumulative distance
  let cumulativeDistance = 0
  const profile = data.results.map((result, index) => {
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
      elevation: result.elevation, // Can be null for ocean/missing data
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
