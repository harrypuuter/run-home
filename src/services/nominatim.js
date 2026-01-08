const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

// Germany bounding box (SW corner to NE corner: minLon,minLat,maxLon,maxLat)
const GERMANY_VIEWBOX = '5.87,47.27,15.04,55.06'

/**
 * Search for locations using Nominatim API (restricted to Germany)
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of location results
 */
export async function searchLocation(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    addressdetails: '1',
    viewbox: GERMANY_VIEWBOX,
    bounded: '1',
    countrycodes: 'de', // Restrict to Germany
  })

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      'Accept': 'application/json',
      // Nominatim requires a valid User-Agent
      'User-Agent': 'RunHomeApp/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Nominatim search failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Reverse geocode coordinates to get address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} - Location details
 */
export async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: 'json',
    addressdetails: '1',
  })

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RunHomeApp/1.0',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Nominatim reverse geocode failed: ${response.status}`)
  }

  return response.json()
}
