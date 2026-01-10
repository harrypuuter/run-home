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

// In-memory cache for elevation points keyed by quantized lat,lng
// Value shape: { v: number, ts: number, lastAccess: number }
const elevationCache = new Map()

// Cache limits and TTL
const CACHE_MAX_ENTRIES = 10000
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

// Load cache from localStorage if available to persist between reloads
try {
  const raw = localStorage.getItem('elevationCache')
  if (raw) {
    const parsed = JSON.parse(raw)
    for (const k of Object.keys(parsed)) {
      const entry = parsed[k]
      // Backwards compat: previous format stored numbers; convert to object
      if (entry && typeof entry === 'object' && 'v' in entry) {
        elevationCache.set(k, entry)
      } else {
        elevationCache.set(k, { v: entry, ts: Date.now(), lastAccess: Date.now() })
      }
    }
  }
} catch (err) {
  // ignore localStorage problems
}

function persistCache() {
  try {
    const obj = Object.fromEntries(elevationCache)
    localStorage.setItem('elevationCache', JSON.stringify(obj))
  } catch (err) {
    // ignore
  }
}

function cacheKey(lat, lng, precision = 4) {
  // Quantize to ~11m at equator when precision=4
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`
}

function evictIfNeeded() {
  const now = Date.now()
  // Remove TTL-expired entries first
  for (const [k, entry] of elevationCache) {
    if (entry && entry.ts && (now - entry.ts) > CACHE_TTL_MS) {
      elevationCache.delete(k)
    }
  }

  // If still over capacity, remove oldest entries (Map iteration order)
  while (elevationCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = elevationCache.keys().next().value
    elevationCache.delete(oldestKey)
  }
}

/**
 * Resample coordinates so points are equally spaced along the path.
 * This prevents uneven sampling that causes smoothing artifacts.
 * @param {Array} coords - Array of [lng, lat]
 * @param {number} targetPoints - desired number of points (approx)
 * @returns {Array} - Array of { lat, lng, distance }
 */
function resampleAlongDistance(coords, targetPoints = 100) {
  if (!coords || coords.length === 0) return []

  // Build cumulative distances at each vertex
  const cumDist = [0]
  for (let i = 1; i < coords.length; i++) {
    const [lng0, lat0] = coords[i - 1]
    const [lng1, lat1] = coords[i]
    cumDist.push(cumDist[cumDist.length - 1] + haversineDistance(lat0, lng0, lat1, lng1))
  }

  const total = cumDist[cumDist.length - 1]
  if (total === 0) {
    // Degenerate path, return first point
    const [lng, lat] = coords[0]
    return [{ lat, lng, distance: 0 }]
  }

  const spacing = total / (Math.max(2, targetPoints) - 1)
  const out = []

  for (let i = 0; i < targetPoints; i++) {
    const d = Math.min(total, i * spacing)
    // find segment where d lies
    let idx = 0
    while (idx < cumDist.length - 1 && cumDist[idx + 1] < d) idx++

    const segStart = cumDist[idx]
    const segEnd = cumDist[idx + 1] || segStart
    const t = segEnd === segStart ? 0 : (d - segStart) / (segEnd - segStart)

    const [lng0, lat0] = coords[idx]
    const [lng1, lat1] = coords[Math.min(idx + 1, coords.length - 1)]

    // Linear interpolation in lat/lng space is acceptable for short segments
    const lat = lat0 + (lat1 - lat0) * t
    const lng = lng0 + (lng1 - lng0) * t

    out.push({ lat, lng, distance: d })
  }

  return out
}

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

  // Resample along distance to get roughly equally spaced points
  const targetPoints = 100
  const sampled = resampleAlongDistance(coordinates, targetPoints)

  console.log('[Elevation] Resampled to', sampled.length, 'equally spaced points from', coordinates.length, 'vertices')

  try {
    // Check cache first and prepare batches for missing points
    const batchCoordsToFetch = []
    const finalProfile = sampled.map(p => ({ lat: p.lat, lng: p.lng, elevation: null, distance: p.distance }))

    // Determine which points we need to fetch
    const missingIndices = []
    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i]
      const key = cacheKey(p.lat, p.lng)

      if (elevationCache.has(key)) {
        // Update LRU timestamp and move to the end
        const cached = elevationCache.get(key)
        cached.lastAccess = Date.now()
        // Re-insert to update insertion order (simple LRU behavior)
        elevationCache.delete(key)
        elevationCache.set(key, cached)
        finalProfile[i].elevation = typeof cached.v === 'number' ? cached.v : null
      } else {
        missingIndices.push(i)
      }
    }

    // Batch fetch missing points (Open-Meteo accepts comma-separated lat/lon lists)
    const batchSize = 50
    for (let bi = 0; bi < missingIndices.length; bi += batchSize) {
      const batchIdx = missingIndices.slice(bi, bi + batchSize)
      const latitudes = batchIdx.map(i => sampled[i].lat.toFixed(6)).join(',')
      const longitudes = batchIdx.map(i => sampled[i].lng.toFixed(6)).join(',')
      const url = `${OPEN_METEO_URL}?latitude=${latitudes}&longitude=${longitudes}`

      console.log('[Elevation] Fetching batch', Math.floor(bi / batchSize) + 1, 'of', Math.ceil(missingIndices.length / batchSize))

      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

      const data = await response.json()
      if (!data.elevation || !Array.isArray(data.elevation)) throw new Error('Invalid response format')

      // Apply returned elevations to the corresponding indices and cache them
      for (let j = 0; j < batchIdx.length; j++) {
        const idx = batchIdx[j]
        const elevation = data.elevation[j]
        finalProfile[idx].elevation = typeof elevation === 'number' && !isNaN(elevation) ? elevation : null
        const key = cacheKey(sampled[idx].lat, sampled[idx].lng)
        if (finalProfile[idx].elevation !== null) {
          // Store with metadata
          elevationCache.set(key, { v: finalProfile[idx].elevation, ts: Date.now(), lastAccess: Date.now() })
        }
      }

      // Evict old entries and enforce max size
      evictIfNeeded()

      // Persist cache periodically
      persistCache()
    }

    const validCount = finalProfile.filter(p => p.elevation !== null).length
    console.log('[Elevation] Got', finalProfile.length, 'points,', validCount, 'with valid elevation')

    // Run eviction once more to keep cache tidy after processing
    evictIfNeeded()

    // Apply smoothing to reduce spikes. Use a two-pass approach and a larger minimum window
    const totalDistance = finalProfile.length > 0 ? finalProfile[finalProfile.length - 1].distance : 0
    // Aim to smooth over at least ~200m (to compensate for meter-quantized API values) or a small
    // percentage of total route length (3%), whichever is larger.
    const windowMeters = Math.max(200, Math.floor(totalDistance * 0.03))
    const spacing = finalProfile.length > 1 ? (totalDistance / (finalProfile.length - 1)) : 1

    let windowSize = Math.max(3, Math.round(windowMeters / Math.max(1, spacing)))
    if (windowSize % 2 === 0) windowSize += 1 // make it odd for symmetry
    // Cap window size reasonably to not exceed profile length
    windowSize = Math.min(windowSize, Math.max(3, finalProfile.length - (finalProfile.length % 2 === 0 ? 1 : 0)))

    // First pass: stronger smoothing
    const firstPass = smoothElevationProfile(finalProfile, windowSize)
    // Second pass: light smoothing to reduce remaining stair-steps (smaller window)
    const lightWindow = Math.max(3, Math.round(windowSize / 3))
    const smoothedProfile = smoothElevationProfile(firstPass, lightWindow % 2 === 1 ? lightWindow : lightWindow + 1)

    console.log('[Elevation] Applied two-pass smoothing to profile (window sizes:', windowSize, ',', lightWindow, ')')

    return smoothedProfile

  } catch (err) {
    console.error('[Elevation] Open-Meteo failed:', err.message)
    // Convert sampled into fallback shape
    return generateFallbackProfile(sampled.map(p => [p.lng, p.lat]))
  }
}

/**
 * Smooth elevation profile using weighted moving average
 * Reduces spikes while preserving overall shape
 * @param {Array} profile - Array of { lat, lng, elevation, distance }
 * @param {number} windowSize - Size of the smoothing window (default 9)
 * @returns {Array} - Smoothed profile
 */
function smoothElevationProfile(profile, windowSize = 9) {
  if (profile.length < windowSize) return profile

  // Gaussian-like weights for the window (center-weighted)
  const weights = []
  const halfWindow = Math.floor(windowSize / 2)
  let weightSum = 0

  for (let i = 0; i < windowSize; i++) {
    const distance = Math.abs(i - halfWindow)
    const weight = Math.exp(-(distance * distance) / (2 * (halfWindow / 2) ** 2))
    weights.push(weight)
    weightSum += weight
  }

  // Normalize weights
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= weightSum
  }

  return profile.map((point, index) => {
    if (point.elevation === null) return point

    // Keep first and last few points unchanged to preserve endpoints
    if (index < halfWindow || index >= profile.length - halfWindow) {
      return point
    }

    // Calculate weighted average of neighboring elevations
    let smoothedElevation = 0
    let validWeightSum = 0

    for (let j = -halfWindow; j <= halfWindow; j++) {
      const neighborIndex = index + j
      const neighborPoint = profile[neighborIndex]

      if (neighborPoint && neighborPoint.elevation !== null) {
        const weightIndex = j + halfWindow
        smoothedElevation += neighborPoint.elevation * weights[weightIndex]
        validWeightSum += weights[weightIndex]
      }
    }

    // Normalize by actual valid weights used
    if (validWeightSum > 0) {
      smoothedElevation /= validWeightSum
    } else {
      smoothedElevation = point.elevation
    }

    return {
      ...point,
      elevation: smoothedElevation,
    }
  })
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

// --- Test helpers (not for production use) ---
export function _clearElevationCache() {
  elevationCache.clear()
  persistCache()
}

export function _setCacheEntryForTest(key, value, ts = Date.now()) {
  elevationCache.set(key, { v: value, ts, lastAccess: ts })
}

export function _setCacheEntryWithTs(key, value, ts) {
  elevationCache.set(key, { v: value, ts, lastAccess: ts })
}

export function _evictOldEntries() {
  evictIfNeeded()
}

export function _cacheSize() {
  return elevationCache.size
}

export { cacheKey }
