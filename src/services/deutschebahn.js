/**
 * Deutsche Bahn REST API service
 * Using the public db.transport.rest API (v5 and v6)
 *
 * API Documentation:
 * - v6: https://v6.db.transport.rest/api.html
 * - v5: https://v5.db.transport.rest/api.html
 *
 * Rate limit: 100 requests/minute
 */

// Try v6 first, fallback to v5
const DB_API_ENDPOINTS = [
  'https://v6.db.transport.rest',
  'https://v5.db.transport.rest',
]

let currentEndpointIndex = 0

// API availability state
let apiAvailable = null // null = not checked, true = available, false = unavailable
let apiCheckPromise = null

function getApiBase() {
  return DB_API_ENDPOINTS[currentEndpointIndex]
}

function switchToNextEndpoint() {
  if (currentEndpointIndex < DB_API_ENDPOINTS.length - 1) {
    currentEndpointIndex++
    log('Switching to fallback API:', getApiBase())
    return true
  }
  return false
}

// Enable detailed logging
const DEBUG = true

// Request timeout in milliseconds (shorter to fail faster to fallback)
const REQUEST_TIMEOUT = 8000

// Shorter timeout for availability check
const AVAILABILITY_CHECK_TIMEOUT = 5000

function log(...args) {
  if (DEBUG) {
    console.log('[DB API]', ...args)
  }
}

function logError(...args) {
  console.error('[DB API Error]', ...args)
}

/**
 * Get current API availability status
 * @returns {boolean|null} - true if available, false if unavailable, null if not yet checked
 */
export function getApiAvailability() {
  return apiAvailable
}

/**
 * Check if the DB API is available
 * This performs a lightweight request to verify connectivity
 * @returns {Promise<boolean>} - true if API is available
 */
export async function checkApiAvailability() {
  // If already checking, return the existing promise
  if (apiCheckPromise) {
    return apiCheckPromise
  }

  apiCheckPromise = (async () => {
    log('Checking DB API availability...')

    for (let i = 0; i < DB_API_ENDPOINTS.length; i++) {
      const endpoint = DB_API_ENDPOINTS[i]
      const testUrl = `${endpoint}/locations?query=Berlin&results=1`

      try {
        log(`Testing endpoint ${i + 1}/${DB_API_ENDPOINTS.length}: ${endpoint}`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), AVAILABILITY_CHECK_TIMEOUT)

        const response = await fetch(testUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data) && data.length > 0) {
            log(`✓ API available at ${endpoint}`)
            currentEndpointIndex = i
            apiAvailable = true
            apiCheckPromise = null
            return true
          }
        }
        log(`✗ Endpoint ${endpoint} returned invalid response: ${response.status}`)
      } catch (error) {
        if (error.name === 'AbortError') {
          log(`✗ Endpoint ${endpoint} timed out`)
        } else {
          log(`✗ Endpoint ${endpoint} error:`, error.message)
        }
      }
    }

    log('✗ All DB API endpoints unavailable')
    apiAvailable = false
    apiCheckPromise = null
    return false
  })()

  return apiCheckPromise
}

/**
 * Make a fetch request with timeout and error handling
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    log('Fetching:', url)
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The API may be temporarily unavailable.')
    }
    throw error
  }
}

// Germany bounding box (approximate) — retained for reference
export const GERMANY_BOUNDS = {
  minLat: 47.27,
  maxLat: 55.06,
  minLng: 5.87,
  maxLng: 15.04,
}

// Note: The previous helper `isInGermany` was removed to allow global location selection.
// Keep `GERMANY_BOUNDS` available for any future validations or heuristics.

/**
 * Search for stops/stations near a location
 * @param {Object} options
 * @param {number} options.lat - Latitude
 * @param {number} options.lng - Longitude
 * @param {number} options.distance - Search radius in meters (max ~5000)
 * @param {number} options.results - Max number of results
 * @returns {Promise<Array>} - Array of nearby stops
 */
export async function fetchNearbyStops({ lat, lng, distance = 5000, results = 20 }) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    results: results.toString(),
    distance: Math.min(distance, 10000).toString(), // Max 10km
    stops: 'true',
    poi: 'false',
    pretty: 'false',
  })

  // Try each endpoint until one works
  let lastError = null

  for (let attempt = 0; attempt < DB_API_ENDPOINTS.length; attempt++) {
    const apiBase = DB_API_ENDPOINTS[(currentEndpointIndex + attempt) % DB_API_ENDPOINTS.length]
    const url = `${apiBase}/locations/nearby?${params}`

    log(`Attempt ${attempt + 1}: Fetching nearby stops from ${apiBase}`)
    log('URL:', url)
    log('Parameters:', { lat, lng, distance, results })

    try {
      const response = await fetchWithTimeout(url)

      log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        let errorDetail = response.statusText
        try {
          const errorText = await response.text()
          logError('API error response body:', errorText)
          errorDetail = errorText || errorDetail
        } catch (e) {
          // Ignore text parsing errors
        }
        throw new Error(`DB API error (${response.status}): ${errorDetail}`)
      }

      const data = await response.json()
      log('Received', data.length, 'stops from API')
      if (data.length > 0) {
        log('First 3 stops:', data.slice(0, 3).map(s => ({ id: s.id, name: s.name })))
      }

      // Update current endpoint to the one that worked
      currentEndpointIndex = (currentEndpointIndex + attempt) % DB_API_ENDPOINTS.length

      // Transform to our format
      const stops = data.map((stop) => ({
        id: stop.id,
        name: stop.name,
        lat: stop.location?.latitude,
        lng: stop.location?.longitude,
        type: getStopType(stop.products),
        products: stop.products,
        distance: stop.distance, // meters from search point
      }))

      log('Transformed', stops.length, 'stops')
      return stops

    } catch (error) {
      logError(`Attempt ${attempt + 1} failed:`, error.message)
      lastError = error

      // If it's a network error, try the next endpoint
      if (error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('timed out') ||
          error.message.includes('AbortError')) {
        log('Trying next endpoint...')
        continue
      }

      // For other errors, throw immediately
      throw error
    }
  }

  // All DB API endpoints failed
  logError('All DB API endpoints failed')

  // Provide helpful error messages
  if (lastError?.message.includes('NetworkError') || lastError?.message.includes('Failed to fetch')) {
    throw new Error('Network error: Unable to reach the Deutsche Bahn API. Please check your internet connection or try again later.')
  }
  if (lastError?.message.includes('timed out')) {
    throw new Error('The Deutsche Bahn API is not responding. Please try again later.')
  }
  throw lastError || new Error('Failed to fetch transit stops from all API endpoints')
}



/**
 * Determine the primary stop type from products
 */
function getStopType(products) {
  if (!products) return 'train'
  if (products.subway) return 'metro'
  if (products.nationalExpress || products.national) return 'train'
  if (products.suburban) return 'suburban'
  if (products.tram) return 'tram'
  if (products.bus) return 'bus'
  if (products.regional || products.regionalExpress) return 'train'
  return 'train'
}

/**
 * Get departures from a stop
 * @param {Object} options
 * @param {string} options.stopId - Stop ID
 * @param {Date} options.when - When to search for departures
 * @param {number} options.duration - Duration in minutes to search
 * @returns {Promise<Array>} - Array of departures
 */
export async function fetchDepartures({ stopId, when, duration = 60 }) {
  const params = new URLSearchParams({
    when: when.toISOString(),
    duration: duration.toString(),
    results: '20',
    stopovers: 'true',
    pretty: 'false',
  })

  const url = `${getApiBase()}/stops/${encodeURIComponent(stopId)}/departures?${params}`
  log('Fetching departures:', url)

  const response = await fetchWithTimeout(url)

  if (!response.ok) {
    throw new Error(`DB API departures failed: ${response.status}`)
  }

  const data = await response.json()

  return data.map((dep) => ({
    tripId: dep.tripId,
    direction: dep.direction,
    line: {
      name: dep.line?.name,
      product: dep.line?.product,
      mode: dep.line?.mode,
      operator: dep.line?.operator?.name,
    },
    when: dep.when,
    plannedWhen: dep.plannedWhen,
    delay: dep.delay, // in seconds
    platform: dep.platform,
    plannedPlatform: dep.plannedPlatform,
    stop: {
      id: dep.stop?.id,
      name: dep.stop?.name,
    },
  }))
}

/**
 * Find journey from one location to another
 * @param {Object} options
 * @param {string|Object} options.from - Origin (stop ID or {latitude, longitude, address})
 * @param {string|Object} options.to - Destination (stop ID or {latitude, longitude, address})
 * @param {Date} options.departure - Departure time
 * @param {number} options.results - Number of journeys to return
 * @returns {Promise<Object>} - Journey results
 */
export async function findJourneys({ from, to, departure, results = 3 }) {
  log('Finding journeys:', { from, to, departure, results })

  const params = new URLSearchParams({
    results: results.toString(),
    stopovers: 'true',
    polylines: 'false',
    remarks: 'true',
    pretty: 'false',
  })

  // Handle from location
  if (typeof from === 'string') {
    params.set('from', from)
  } else {
    params.set('from.latitude', from.latitude.toString())
    params.set('from.longitude', from.longitude.toString())
    if (from.address) {
      params.set('from.address', from.address)
    }
  }

  // Handle to location
  if (typeof to === 'string') {
    params.set('to', to)
  } else {
    params.set('to.latitude', to.latitude.toString())
    params.set('to.longitude', to.longitude.toString())
    if (to.address) {
      params.set('to.address', to.address)
    }
  }

  if (departure) {
    params.set('departure', departure.toISOString())
  }

  // Try each endpoint
  let lastError = null

  for (let attempt = 0; attempt < DB_API_ENDPOINTS.length; attempt++) {
    const apiBase = DB_API_ENDPOINTS[(currentEndpointIndex + attempt) % DB_API_ENDPOINTS.length]
    const url = `${apiBase}/journeys?${params}`

    log(`Journey attempt ${attempt + 1}: ${apiBase}`)
    log('Journey API URL:', url)

    try {
      const response = await fetchWithTimeout(url)

      log('Journey response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        logError('Journey API error:', errorText)
        throw new Error(`DB API journeys failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      log('Received', data.journeys?.length || 0, 'journeys')

      return {
        journeys: data.journeys?.map(transformJourney) || [],
        earlierRef: data.earlierRef,
        laterRef: data.laterRef,
      }
    } catch (error) {
      logError(`Journey attempt ${attempt + 1} failed:`, error.message)
      lastError = error

      // If it's a network error, try the next endpoint
      if (error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('timed out')) {
        continue
      }

      // For other errors (like 400 Bad Request), don't retry
      throw error
    }
  }

  // All endpoints failed
  logError('All journey API endpoints failed')
  throw lastError || new Error('Failed to find journeys from all API endpoints')
}

/**
 * Transform a journey to our format
 */
function transformJourney(journey) {
  return {
    type: 'journey',
    legs: journey.legs?.map((leg) => ({
      origin: {
        id: leg.origin?.id,
        name: leg.origin?.name,
        departure: leg.departure,
        plannedDeparture: leg.plannedDeparture,
        departureDelay: leg.departureDelay,
        platform: leg.departurePlatform,
        plannedPlatform: leg.plannedDeparturePlatform,
        location: leg.origin?.location,
      },
      destination: {
        id: leg.destination?.id,
        name: leg.destination?.name,
        arrival: leg.arrival,
        plannedArrival: leg.plannedArrival,
        arrivalDelay: leg.arrivalDelay,
        platform: leg.arrivalPlatform,
        plannedPlatform: leg.plannedArrivalPlatform,
        location: leg.destination?.location,
      },
      line: leg.line ? {
        name: leg.line.name,
        product: leg.line.product,
        mode: leg.line.mode,
        direction: leg.direction,
        operator: leg.line.operator?.name,
      } : null,
      walking: leg.walking || false,
      distance: leg.distance, // for walking legs
      duration: calculateDuration(leg.departure || leg.plannedDeparture, leg.arrival || leg.plannedArrival),
      stopovers: leg.stopovers?.map((s) => ({
        stop: { id: s.stop?.id, name: s.stop?.name },
        arrival: s.arrival,
        departure: s.departure,
      })),
    })) || [],
    refreshToken: journey.refreshToken,
    price: journey.price,
  }
}

/**
 * Calculate duration in minutes between two ISO date strings
 */
function calculateDuration(start, end) {
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  return Math.round((endDate - startDate) / 60000) // minutes
}

/**
 * Search for a stop by name
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of matching stops
 */
export async function searchStops(query) {
  const params = new URLSearchParams({
    query,
    results: '10',
    stops: 'true',
    addresses: 'false',
    poi: 'false',
    pretty: 'false',
  })

  const url = `${getApiBase()}/locations?${params}`
  log('Searching stops:', url)

  const response = await fetchWithTimeout(url)

  if (!response.ok) {
    throw new Error(`DB API search failed: ${response.status}`)
  }

  const data = await response.json()

  return data.filter((item) => item.type === 'stop').map((stop) => ({
    id: stop.id,
    name: stop.name,
    lat: stop.location?.latitude,
    lng: stop.location?.longitude,
    type: getStopType(stop.products),
    products: stop.products,
  }))
}

/**
 * Get stop icon emoji based on type
 */
export function getStopIcon(type) {
  switch (type) {
    case 'metro':
      return '🚇'
    case 'suburban':
      return '🚈'
    case 'tram':
      return '🚊'
    case 'bus':
      return '🚌'
    case 'train':
    default:
      return '🚆'
  }
}

/**
 * Get product icon emoji
 */
export function getProductIcon(product) {
  switch (product) {
    case 'nationalExpress':
      return '🚄' // ICE
    case 'national':
      return '🚃' // IC/EC
    case 'regionalExpress':
    case 'regional':
      return '🚆' // RE/RB
    case 'suburban':
      return '🚈' // S-Bahn
    case 'subway':
      return '🚇' // U-Bahn
    case 'tram':
      return '🚊'
    case 'bus':
      return '🚌'
    case 'ferry':
      return '⛴️'
    default:
      return '🚆'
  }
}

/**
 * Format delay for display
 */
export function formatDelay(delaySeconds) {
  if (!delaySeconds || delaySeconds === 0) return null
  const minutes = Math.round(delaySeconds / 60)
  if (minutes > 0) {
    return `+${minutes}`
  }
  return `${minutes}`
}

/**
 * Format time from ISO string
 */
export function formatTime(isoString) {
  if (!isoString) return '--:--'
  const date = new Date(isoString)
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
