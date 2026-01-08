// Use OSRM.de servers which have proper foot/bike profiles
// The demo server at router.project-osrm.org doesn't properly differentiate profiles
const OSRM_SERVERS = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
}

/**
 * Calculate route using OSRM
 * @param {Object} options
 * @param {number} options.startLat - Start latitude
 * @param {number} options.startLng - Start longitude
 * @param {number} options.endLat - End latitude
 * @param {number} options.endLng - End longitude
 * @param {string} options.profile - Routing profile ('foot' or 'bike')
 * @returns {Promise<Object>} - Route data
 */
export async function calculateRoute({ startLat, startLng, endLat, endLng, profile = 'foot' }) {
  // OSRM uses lng,lat order
  const coordinates = `${startLng},${startLat};${endLng},${endLat}`

  // Select the appropriate server for the profile
  const baseUrl = OSRM_SERVERS[profile] || OSRM_SERVERS.foot
  const url = `${baseUrl}/${coordinates}?overview=full&geometries=geojson`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`OSRM routing failed: ${response.status}`)
  }

  const data = await response.json()

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('No route found')
  }

  const route = data.routes[0]

  return {
    distance: route.distance, // in meters
    duration: route.duration, // in seconds
    geometry: route.geometry, // GeoJSON geometry
  }
}

/**
 * Calculate routes for multiple stops
 * @param {Array} stops - Array of transit stops
 * @param {Object} home - Home location { lat, lng }
 * @param {string} profile - Routing profile
 * @returns {Promise<Array>} - Array of routes
 */
export async function calculateRoutesForStops(stops, home, profile = 'foot') {
  const routes = []

  // Process in batches to avoid rate limiting
  for (const stop of stops) {
    try {
      const route = await calculateRoute({
        startLat: stop.lat,
        startLng: stop.lng,
        endLat: home.lat,
        endLng: home.lng,
        profile,
      })

      routes.push({
        stopId: stop.id,
        stop,
        route,
      })

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`Failed to calculate route for stop ${stop.id}:`, error)
    }
  }

  return routes
}
