/**
 * Shared API mock responses for E2E tests.
 * Using realistic responses captured from actual API calls to ensure deterministic tests.
 *
 * Default debug location is Berlin Alexanderplatz (52.52, 13.405)
 * Default distance is 8km, direction is 'any'
 * 
 * For 8km distance:
 * - innerRadius = 4000m (0.5 * 8km)
 * - outerRadius = 8000m (1.0 * 8km)
 * Stations must be 4-8km from home to pass the annulus filter.
 * At 52°N latitude: 1° lat ≈ 111km, 1° lon ≈ 68km
 * So 6km ≈ 0.054° lat or 0.088° lon
 */

// Overpass API response for transit stations 4-8km from Berlin Alexanderplatz (52.52, 13.405)
export const overpassStationsResponse = {
  version: 0.6,
  generator: 'Overpass API',
  elements: [
    {
      type: 'node',
      id: 314785001,
      lat: 52.574,  // ~6km north (0.054° north)
      lon: 13.405,
      tags: {
        name: 'Gesundbrunnen',
        railway: 'station',
        public_transport: 'station',
        network: 'VBB'
      }
    },
    {
      type: 'node',
      id: 314785002,
      lat: 52.466,  // ~6km south
      lon: 13.405,
      tags: {
        name: 'Hermannplatz',
        railway: 'station',
        public_transport: 'station',
        network: 'VBB'
      }
    },
    {
      type: 'node',
      id: 314785003,
      lat: 52.52,   // ~6km east (0.088° east)
      lon: 13.493,
      tags: {
        name: 'Lichtenberg',
        railway: 'station',
        public_transport: 'station',
        network: 'VBB'
      }
    },
    {
      type: 'node',
      id: 314785004,
      lat: 52.52,   // ~6km west
      lon: 13.317,
    }
  ]
}

// OSRM route response for a ~8km route (Berlin area - from home to station ~6km away)
export const osrmRouteResponse = {
  code: 'Ok',
  routes: [
    {
      distance: 7823.4,  // ~7.8km
      duration: 2807.2,
      weight: 2807.2,
      weight_name: 'routability',
      geometry: {
        type: 'LineString',
        coordinates: [
          [13.405, 52.52],    // Start: Alexanderplatz
          [13.405, 52.53],
          [13.405, 52.54],
          [13.405, 52.55],
          [13.405, 52.56],
          [13.405, 52.574]    // End: Gesundbrunnen
        ]
      }
    }
  ],
  waypoints: [
    { name: 'Alexanderplatz', location: [13.405, 52.52], distance: 0 },
    { name: 'Gesundbrunnen', location: [13.405, 52.574], distance: 0 }
  ]
}

// Open-Meteo elevation response generator (returns flat 120m elevation for simplicity)
export function createElevationResponse(pointCount) {
  return {
    elevation: Array(pointCount).fill(120)
  }
}

/**
 * Setup all API mocks for a page.
 * Call this before navigating to the debug page.
 */
export async function setupApiMocks(page, options = {}) {
  const {
    overpassResponse = overpassStationsResponse,
    osrmResponse = osrmRouteResponse,
    elevationValue = 120
  } = options

  // Mock Overpass API (all endpoints including alternates)
  await page.route('**/api/interpreter*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overpassResponse)
    })
  })

  // Mock OSRM routing API
  await page.route('**/route/v1/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(osrmResponse)
    })
  })

  // Also match the routed-* pattern used in some tests
  await page.route('**/routed-*/route/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(osrmResponse)
    })
  })

  // Mock Open-Meteo elevation API
  await page.route('https://api.open-meteo.com/v1/elevation*', route => {
    try {
      const url = new URL(route.request().url())
      const latParam = url.searchParams.get('latitude') || ''
      const count = latParam ? latParam.split(',').length : 1
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createElevationResponse(count))
      })
    } catch (e) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ elevation: [elevationValue] })
      })
    }
  })
}
