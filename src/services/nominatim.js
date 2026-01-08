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

/**
 * Fetch nearby transit stations from OpenStreetMap Overpass API
 * Used as fallback when Deutsche Bahn API is unavailable
 * @param {Object} options - { lat, lng, radiusMeters }
 * @returns {Promise<Array>} - Array of station objects
 */
export async function fetchOSMTransitStations({ lat, lng, radiusMeters = 15000 }) {
  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

  // Query for railway stations, tram stops, and bus stops
  const query = `
    [out:json][timeout:25];
    (
      node["railway"="station"](around:${radiusMeters},${lat},${lng});
      node["railway"="halt"](around:${radiusMeters},${lat},${lng});
      node["public_transport"="station"](around:${radiusMeters},${lat},${lng});
      node["railway"="tram_stop"](around:${radiusMeters},${lat},${lng});
    );
    out body;
  `

  try {
    console.log('[OSM] Fetching transit stations within', radiusMeters, 'm of', lat, lng)

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    })

    if (!response.ok) {
      throw new Error(`Overpass API failed: ${response.status}`)
    }

    const data = await response.json()
    console.log('[OSM] Found', data.elements?.length || 0, 'transit stations')

    if (!data.elements || data.elements.length === 0) {
      return []
    }

    // Convert to our stop format and calculate distances
    const stations = data.elements.map(el => {
      const distance = haversineDistance(lat, lng, el.lat, el.lon)

      // Determine station type
      let type = 'station'
      if (el.tags?.railway === 'tram_stop') type = 'tram'
      else if (el.tags?.railway === 'halt') type = 'regional'
      else if (el.tags?.railway === 'station') type = 'train'

      return {
        id: `osm-${el.id}`,
        name: el.tags?.name || 'Unnamed Station',
        lat: el.lat,
        lng: el.lon,
        type,
        distance,
        products: null, // No product info from OSM
        isOSMFallback: true,
      }
    })

    // Filter out unnamed stations and sort by distance
    return stations
      .filter(s => s.name !== 'Unnamed Station')
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 50)

  } catch (err) {
    console.error('[OSM] Failed to fetch transit stations:', err)
    return []
  }
}

/**
 * Calculate distance between two points using Haversine formula
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
