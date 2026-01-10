// Lightweight Transitland helper functions
// Uses the Transitland REST API v2: https://transit.land/documentation

const BASE = 'https://transit.land/api/v2/rest'
const DEFAULT_TIMEOUT = 8000

function getApiKey() {
  // Prefer Vite injected env var, fallback to global (for scripts)
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TRANSITLAND_API_KEY) {
      return import.meta.env.VITE_TRANSITLAND_API_KEY
    }
  } catch (e) {
    // ignore
  }
  if (typeof window !== 'undefined' && window.TRANSITLAND_API_KEY) return window.TRANSITLAND_API_KEY
  if (typeof process !== 'undefined' && process.env && process.env.TRANSITLAND_API_KEY) return process.env.TRANSITLAND_API_KEY
  return null
}

async function fetchWithTimeout(url, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    clearTimeout(id)
    return res
  } catch (e) {
    clearTimeout(id)
    throw e
  }
}

/**
 * Get stop details by onestop_id
 * Returns object from Transitland or null if not found
 */
export async function getStopByOnestopId(onestopId) {
  if (!onestopId) throw new Error('Missing onestop_id')
  const key = getApiKey()
  if (!key) throw new Error('Missing Transitland API key. Set VITE_TRANSITLAND_API_KEY in a .env file and restart the dev server, or set window.TRANSITLAND_API_KEY in the browser console for quick testing.')
  const url = `${BASE}/stops/${encodeURIComponent(onestopId)}?apikey=${encodeURIComponent(key)}`
  const res = await fetchWithTimeout(url)
  if (res.status === 404) return null
  if (res.status === 401) throw new Error('Unauthorized (Transitland API key rejected)')
  if (!res.ok) throw new Error(`Transitland API error: ${res.status}`)
  const json = await res.json()
  return json
}

/**
 * Search stops by name and optional location (lat/lon)
 * Returns an array of stops (may be empty)
 */
export async function searchStops({ query, lat, lon, radius = 1000, perPage = 20 } = {}) {
  if (!query) return []
  const key = getApiKey()
  const params = new URLSearchParams({ q: query, per_page: String(perPage) })
  // Transitland supports `lat`/`lon`/`radius` filters for some search patterns
  if (lat && lon) {
    params.set('lat', String(lat))
    params.set('lon', String(lon))
    params.set('radius', String(radius))
  }
  if (key) params.set('apikey', key)
  const url = `${BASE}/stops?${params.toString()}`
  const res = await fetchWithTimeout(url)
  if (res.status === 401) throw new Error('Unauthorized (Transitland API key required)')
  if (!res.ok) throw new Error(`Transitland API error: ${res.status}`)
  const json = await res.json()
  return json.stops || []
}

/**
 * Get routes that stop at the given stop (using stop_onestop_id filter)
 * Returns an array of route objects (may be empty)
 */
export async function getRoutesForStop(onestopId, { perPage = 100 } = {}) {
  if (!onestopId) throw new Error('Missing onestop_id')
  const key = getApiKey()
  if (!key) throw new Error('Missing Transitland API key. Set VITE_TRANSITLAND_API_KEY in a .env file and restart the dev server, or set window.TRANSITLAND_API_KEY in the browser console for quick testing.')
  const params = new URLSearchParams({ stop_onestop_id: onestopId, per_page: String(perPage), apikey: key })
  const url = `${BASE}/routes?${params.toString()}`
  const res = await fetchWithTimeout(url)
  if (res.status === 401) throw new Error('Unauthorized (Transitland API key rejected)')
  if (!res.ok) throw new Error(`Transitland API error: ${res.status}`)
  const json = await res.json()
  return json.routes || []
}

/**
 * Optionally, get upcoming departures for a stop
 */
export async function getDeparturesForStop(onestopId, { minutes = 60, perPage = 50 } = {}) {
  if (!onestopId) throw new Error('Missing onestop_id')
  const key = getApiKey()
  if (!key) throw new Error('Missing Transitland API key. Set VITE_TRANSITLAND_API_KEY in a .env file and restart the dev server, or set window.TRANSITLAND_API_KEY in the browser console for quick testing.')
  const params = new URLSearchParams({ stop_onestop_id: onestopId, minutes: String(minutes), per_page: String(perPage), apikey: key })
  const url = `${BASE}/departures?${params.toString()}`
  const res = await fetchWithTimeout(url)
  if (res.status === 401) throw new Error('Unauthorized (Transitland API key rejected)')
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Transitland API error: ${res.status}`)
  const json = await res.json()
  return json.departures || []
}

/**
 * Fetch a route by its onestop_id to get full details
 */
export async function getRouteByOnestopId(routeOnestopId) {
  if (!routeOnestopId) throw new Error('Missing route onestop_id')
  const key = getApiKey()
  if (!key) throw new Error('Missing Transitland API key. Set VITE_TRANSITLAND_API_KEY in a .env file and restart the dev server, or set window.TRANSITLAND_API_KEY in the browser console for quick testing.')
  const url = `${BASE}/routes/${encodeURIComponent(routeOnestopId)}?apikey=${encodeURIComponent(key)}`
  const res = await fetchWithTimeout(url)
  if (res.status === 404) return null
  if (res.status === 401) throw new Error('Unauthorized (Transitland API key rejected)')
  if (!res.ok) throw new Error(`Transitland API error: ${res.status}`)
  const json = await res.json()
  return json
}
