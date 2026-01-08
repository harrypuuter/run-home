/**
 * GPX export utilities
 */

/**
 * Generate GPX file content from a route
 * @param {Object} route - Route object with geometry
 * @param {Object} stop - Transit stop object
 * @param {Object} home - Home location
 * @param {string} activityType - 'run' or 'bike'
 * @param {Array} elevationProfile - Optional elevation profile data
 * @returns {string} - GPX file content
 */
export function generateGPX(route, stop, home, activityType = 'run', elevationProfile = null) {
  const coordinates = route.geometry?.coordinates || []
  const stopName = stop.name || 'Transit Stop'
  const date = new Date().toISOString()
  const activityName = activityType === 'run' ? 'Running' : 'Cycling'

  // Create a map of elevation data indexed by [lng, lat] for quick lookup
  const elevationMap = new Map()
  if (elevationProfile && elevationProfile.length > 0) {
    elevationProfile.forEach(point => {
      const key = `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`
      elevationMap.set(key, point.elevation)
    })
  }

  // Build track points with elevation data if available
  const trackpoints = coordinates
    .map(([lng, lat]) => {
      // Try to find elevation for this coordinate
      const key = `${lng.toFixed(6)},${lat.toFixed(6)}`
      const elevation = elevationMap.get(key)

      if (elevation !== undefined && elevation !== null) {
        return `      <trkpt lat="${lat}" lon="${lng}"><ele>${elevation.toFixed(1)}</ele></trkpt>`
      }
      return `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`
    })
    .join('\n')

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunHome App"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${activityName} from ${stopName}</name>
    <desc>${activityName} route from ${stopName} to Home - ${(route.distance / 1000).toFixed(1)} km</desc>
    <time>${date}</time>
  </metadata>
  <wpt lat="${stop.lat}" lon="${stop.lng}">
    <name>Start: ${stopName}</name>
    <desc>Transit stop - ${stop.type}</desc>
    <sym>Flag, Blue</sym>
  </wpt>
  <wpt lat="${home.lat}" lon="${home.lng}">
    <name>Finish: Home</name>
    <desc>Home location</desc>
    <sym>Flag, Green</sym>
  </wpt>
  <trk>
    <name>${activityName} from ${stopName}</name>
    <type>${activityType === 'run' ? 'running' : 'cycling'}</type>
    <trkseg>
${trackpoints}
    </trkseg>
  </trk>
</gpx>`

  return gpx
}

/**
 * Download GPX file
 * @param {string} gpxContent - GPX file content
 * @param {string} filename - Filename without extension
 */
export function downloadGPX(gpxContent, filename = 'route') {
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.gpx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Generate a clean filename from stop name
 * @param {string} stopName - Stop name
 * @param {string} activityType - 'run' or 'bike'
 * @returns {string} - Clean filename
 */
export function generateFilename(stopName, activityType = 'run') {
  const cleanName = (stopName || 'route')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)

  const activity = activityType === 'run' ? 'run' : 'bike'
  const date = new Date().toISOString().split('T')[0]

  return `${activity}-${cleanName}-${date}`
}
