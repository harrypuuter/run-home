import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Loader2, RotateCcw, Clock, Route, RefreshCw, MapPin, Navigation, Train, Download, ChevronDown, AlertCircle, AlertTriangle } from 'lucide-react'
import Button from '../ui/Button'
import Map from '../Map'
import ElevationProfile from '../ElevationProfile'
import { fetchNearbyStops, findJourneys, getStopIcon, getProductIcon, formatDelay, formatTime, getApiAvailability } from '../../services/deutschebahn'
import { calculateRoute } from '../../services/osrm'
import { filterByDirection, formatDistance, formatDuration, getDistanceTolerance } from '../../services/geo'
import { generateGPX, downloadGPX, generateFilename } from '../../services/gpx'
import { fetchElevationProfile } from '../../services/elevation'

const ROUTES_PER_PAGE = 3
const ROUTE_COLORS = ['#3b82f6', '#10b981', '#f59e0b'] // blue, green, amber

/**
 * Generate waypoints for direct routes (when transit API is unavailable)
 * Creates points at approximately the target distance in the selected direction(s)
 */
function generateDirectRouteWaypoints({ homeLocation, distance, direction }) {
  const waypoints = []
  const distanceKm = distance

  // Approximate conversion: 1 degree latitude = 111km
  // Longitude varies by latitude: 1 degree = 111km * cos(lat)
  const latOffset = distanceKm / 111
  const lngOffset = distanceKm / (111 * Math.cos(homeLocation.lat * Math.PI / 180))

  // Define direction vectors
  const directions = {
    north: { lat: latOffset, lng: 0, name: 'North', bearing: 0 },
    northeast: { lat: latOffset * 0.707, lng: lngOffset * 0.707, name: 'Northeast', bearing: 45 },
    east: { lat: 0, lng: lngOffset, name: 'East', bearing: 90 },
    southeast: { lat: -latOffset * 0.707, lng: lngOffset * 0.707, name: 'Southeast', bearing: 135 },
    south: { lat: -latOffset, lng: 0, name: 'South', bearing: 180 },
    southwest: { lat: -latOffset * 0.707, lng: -lngOffset * 0.707, name: 'Southwest', bearing: 225 },
    west: { lat: 0, lng: -lngOffset, name: 'West', bearing: 270 },
    northwest: { lat: latOffset * 0.707, lng: -lngOffset * 0.707, name: 'Northwest', bearing: 315 },
  }

  // If direction is 'any', generate waypoints in all cardinal directions
  const selectedDirections = direction === 'any' || !direction
    ? ['north', 'east', 'south', 'west', 'northeast', 'southeast', 'southwest', 'northwest']
    : [direction]

  // For each direction, create multiple waypoints at varying distances (80%, 100%, 120% of target)
  const distanceFactors = [0.8, 1.0, 1.2]

  selectedDirections.forEach((dir) => {
    const d = directions[dir]
    if (!d) return

    distanceFactors.forEach((factor, i) => {
      waypoints.push({
        id: `waypoint-${dir}-${i}`,
        name: `${d.name} Route (${Math.round(distanceKm * factor)}km)`,
        lat: homeLocation.lat + (d.lat * factor),
        lng: homeLocation.lng + (d.lng * factor),
        type: 'waypoint', // Not a transit stop
        products: null,
        distance: distanceKm * factor * 1000, // in meters
        isWaypoint: true, // Flag to identify as non-transit waypoint
      })
    })
  })

  // Sort by distance
  waypoints.sort((a, b) => Math.abs(a.distance - distanceKm * 1000) - Math.abs(b.distance - distanceKm * 1000))

  return waypoints.slice(0, 20) // Limit to 20 waypoints
}

function RouteResults({ state, updateState, onReset, dbApiAvailable }) {
  const [calculatingRoutes, setCalculatingRoutes] = useState(false)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(null)
  const [calculatedRoutes, setCalculatedRoutes] = useState([])
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [searchPhase, setSearchPhase] = useState('') // For loading messages
  const [noTransitMode, setNoTransitMode] = useState(false) // When DB API is unavailable
  const [elevationProfiles, setElevationProfiles] = useState({}) // Cache elevation data per route
  const allStopsRef = useRef([])
  const searchedStopsRef = useRef(new Set())
  const isCalculatingRef = useRef(false) // Prevent duplicate calculations
  const hasInitializedRef = useRef(false) // Track if we've initialized

  const { homeLocation, distance, activity, departureTime, direction, transitStops, isLoading, error } = state

  // Fetch nearby transit stops using DB API (if available)
  useEffect(() => {
    const loadTransitStops = async () => {
      updateState({ isLoading: true, error: null })

      // Check if DB API is available
      const apiStatus = dbApiAvailable ?? getApiAvailability()

      if (apiStatus === false) {
        // DB API is unavailable - switch to no-transit mode
        setNoTransitMode(true)
        setSearchPhase('Finding routes without transit info...')

        // Generate waypoints in the selected direction at target distance
        const waypoints = generateDirectRouteWaypoints({
          homeLocation,
          distance,
          direction,
        })

        updateState({
          transitStops: waypoints,
          isLoading: false,
        })
        return
      }

      setSearchPhase('Finding nearby stations...')

      try {
        // Fetch stops from DB API - search within the target distance
        const stops = await fetchNearbyStops({
          lat: homeLocation.lat,
          lng: homeLocation.lng,
          distance: Math.min(distance * 1000, 50000), // Max 50km for API
          results: 50,
        })

        // Filter by direction
        const filteredStops = filterByDirection(
          stops,
          homeLocation.lat,
          homeLocation.lng,
          direction
        )

        // Sort by distance from home
        const sorted = [...filteredStops].sort((a, b) => (a.distance || 0) - (b.distance || 0))
        allStopsRef.current = sorted
        searchedStopsRef.current = new Set()

        updateState({
          transitStops: sorted,
          isLoading: false,
        })
      } catch (err) {
        console.error('Failed to fetch transit stops:', err)

        // If DB API fails, switch to no-transit mode instead of showing an error
        setNoTransitMode(true)
        setSearchPhase('Transit API unavailable - finding direct routes...')

        const waypoints = generateDirectRouteWaypoints({
          homeLocation,
          distance,
          direction,
        })

        updateState({
          transitStops: waypoints,
          isLoading: false,
          error: null, // Clear error, we're falling back gracefully
        })
      }
    }

    loadTransitStops()
  }, [dbApiAvailable])

  // Calculate routes that match target distance ±15%
  useEffect(() => {
    const calculateMatchingRoutes = async () => {
      // Skip if already calculating or no stops available
      if (isCalculatingRef.current || transitStops.length === 0) return

      // Mark as initializing to prevent double runs
      isCalculatingRef.current = true

      setCalculatingRoutes(true)
      setCalculatedRoutes([])
      setSelectedRouteIndex(null)
      setSearchPhase('Calculating routes...')

      const { min: minDistance, max: maxDistance } = getDistanceTolerance(distance)

      const validRoutes = []
      let attempts = 0
      const maxAttempts = Math.min(transitStops.length, 30)

      for (const stop of transitStops) {
        if (validRoutes.length >= ROUTES_PER_PAGE) break
        if (attempts >= maxAttempts) break
        if (searchedStopsRef.current.has(stop.id)) continue

        attempts++
        searchedStopsRef.current.add(stop.id)
        setSearchPhase(`Checking ${stop.name}...`)

        try {
          // Calculate walking/cycling route from stop to home
          const route = await calculateRoute({
            startLat: stop.lat,
            startLng: stop.lng,
            endLat: homeLocation.lat,
            endLng: homeLocation.lng,
            profile: activity === 'run' ? 'foot' : 'bike',
          })

          // Check if route distance is within tolerance
          if (route.distance >= minDistance && route.distance <= maxDistance) {
            // Find transit journey TO this stop (only if transit API is available)
            let transitJourney = null

            if (!noTransitMode && !stop.isWaypoint) {
              setSearchPhase(`Finding transit to ${stop.name}...`)
              try {
                const journeyResult = await findJourneys({
                  from: {
                    latitude: homeLocation.lat,
                    longitude: homeLocation.lng,
                    address: homeLocation.displayName || 'Home',
                  },
                  to: stop.id,
                  departure: new Date(departureTime),
                  results: 1,
                })

                if (journeyResult.journeys && journeyResult.journeys.length > 0) {
                  transitJourney = journeyResult.journeys[0]
                }
              } catch (journeyErr) {
                console.warn('Failed to fetch journey:', journeyErr)
                // Don't fail the route, just skip transit info
              }
            }

            validRoutes.push({
              stop,
              route,
              color: ROUTE_COLORS[validRoutes.length % ROUTE_COLORS.length],
              transitJourney,
              noTransitInfo: noTransitMode || stop.isWaypoint,
            })

            // Update as we go for better UX
            setCalculatedRoutes([...validRoutes])
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 150))
        } catch (err) {
          console.error(`Failed to calculate route for stop ${stop.id}:`, err)
        }
      }

      setCalculatingRoutes(false)
      setSearchPhase('')
      isCalculatingRef.current = false
    }

    calculateMatchingRoutes()
  }, [transitStops]) // Only depend on transitStops - other values are stable during route calculation

  const handleGenerateMore = useCallback(async () => {
    setCalculatingRoutes(true)
    setSearchPhase('Finding more routes...')

    const { min: minDistance, max: maxDistance } = getDistanceTolerance(distance)
    const currentRoutes = [...calculatedRoutes]
    let attempts = 0
    const maxAttempts = 20

    for (const stop of transitStops) {
      if (currentRoutes.length >= calculatedRoutes.length + ROUTES_PER_PAGE) break
      if (attempts >= maxAttempts) break
      if (searchedStopsRef.current.has(stop.id)) continue

      attempts++
      searchedStopsRef.current.add(stop.id)
      setSearchPhase(`Checking ${stop.name}...`)

      try {
        const route = await calculateRoute({
          startLat: stop.lat,
          startLng: stop.lng,
          endLat: homeLocation.lat,
          endLng: homeLocation.lng,
          profile: activity === 'run' ? 'foot' : 'bike',
        })

        if (route.distance >= minDistance && route.distance <= maxDistance) {
          let transitJourney = null

          // Only fetch transit journey if API is available and this is a real transit stop
          if (!noTransitMode && !stop.isWaypoint) {
            try {
              const journeyResult = await findJourneys({
                from: {
                  latitude: homeLocation.lat,
                  longitude: homeLocation.lng,
                },
                to: stop.id,
                departure: new Date(departureTime),
                results: 1,
              })
              if (journeyResult.journeys?.length > 0) {
                transitJourney = journeyResult.journeys[0]
              }
            } catch (e) {
              console.warn('Journey fetch failed:', e)
            }
          }

          currentRoutes.push({
            stop,
            route,
            color: ROUTE_COLORS[currentRoutes.length % ROUTE_COLORS.length],
            transitJourney,
            noTransitInfo: noTransitMode || stop.isWaypoint,
          })
          setCalculatedRoutes([...currentRoutes])
        }

        await new Promise((resolve) => setTimeout(resolve, 150))
      } catch (err) {
        console.error(`Route calculation failed for ${stop.id}:`, err)
      }
    }

    setCalculatingRoutes(false)
    setSearchPhase('')
  }, [distance, calculatedRoutes, transitStops, homeLocation, activity, departureTime, noTransitMode])

  const handleDownloadGPX = useCallback(async (e, item) => {
    e.stopPropagation()

    // Check if we already have elevation data cached
    let elevationProfile = elevationProfiles[item.stop.id]

    if (!elevationProfile) {
      // Fetch elevation data if not already cached
      try {
        elevationProfile = await fetchElevationProfile(item.route.geometry.coordinates)

        // Cache it for future use
        setElevationProfiles(prev => ({
          ...prev,
          [item.stop.id]: elevationProfile
        }))
      } catch (err) {
        console.warn('[RouteResults] Failed to fetch elevation for GPX:', err)
        elevationProfile = null
      }
    }

    const gpxContent = generateGPX(item.route, item.stop, homeLocation, activity, elevationProfile)
    const filename = generateFilename(item.stop.name, activity)
    downloadGPX(gpxContent, filename)
  }, [homeLocation, activity, elevationProfiles])

  const hasMoreRoutes = transitStops.some(s => !searchedStopsRef.current.has(s.id))

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
        <p className="text-slate-300">{searchPhase || 'Finding stations...'}</p>
      </div>
    )
  }

  if (error) {
    const isNetworkError = error.includes('NetworkError') || error.includes('not responding') || error.includes('fetch')

    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="font-medium">Error loading transit data</p>
              <p className="text-sm text-red-200/80">{error}</p>
              {isNetworkError && (
                <p className="text-xs text-red-200/60">
                  The Deutsche Bahn API may be temporarily unavailable. Please check your internet connection and try again.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={() => {
              updateState({ error: null, isLoading: true })
              window.location.reload()
            }}
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
          <Button variant="secondary" onClick={onReset} className="flex-1">
            <RotateCcw className="w-4 h-4" />
            Start Over
          </Button>
        </div>
      </div>
    )
  }

  if (transitStops.length === 0) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-center">
          No transit stops found. Try increasing distance or changing direction.
        </div>
        <Button variant="secondary" onClick={onReset} className="w-full">
          <RotateCcw className="w-4 h-4" />
          Start Over
        </Button>
      </div>
    )
  }

  const { min: minDistance, max: maxDistance } = getDistanceTolerance(distance)

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Notice when transit API is unavailable */}
      {noTransitMode && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Transit information unavailable</p>
              <p className="text-amber-200/70 text-xs mt-0.5">
                The Deutsche Bahn API is currently not responding. Routes are shown without public transport details.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-sm md:text-base text-slate-400 text-center">
        {calculatedRoutes.length > 0 ? (
          <>
            Showing <span className="font-semibold text-white">{calculatedRoutes.length}</span> routes
            <span className="text-slate-500"> ({(minDistance/1000).toFixed(0)}-{(maxDistance/1000).toFixed(0)} km)</span>
          </>
        ) : calculatingRoutes ? (
          <span>{searchPhase || 'Searching...'}</span>
        ) : (
          <span>No routes found matching <span className="font-semibold text-white">{distance} km</span> (±15%)</span>
        )}
        {calculatingRoutes && calculatedRoutes.length > 0 && (
          <span className="ml-2 text-blue-400">({searchPhase || 'searching...'})</span>
        )}
      </div>

      {/* No routes found message */}
      {!calculatingRoutes && calculatedRoutes.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-center">
          No routes found within {(minDistance/1000).toFixed(0)}-{(maxDistance/1000).toFixed(0)} km range.
          Try adjusting your target distance or changing direction.
        </div>
      )}

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg">
        <Map
          center={[homeLocation.lat, homeLocation.lng]}
          zoom={11}
          marker={[homeLocation.lat, homeLocation.lng]}
          markerType="home"
          routes={calculatedRoutes}
          selectedRouteIndex={selectedRouteIndex}
          hoveredPoint={hoveredPoint}
          className="h-72 md:h-80 lg:h-96 w-full"
        />
      </div>

      {/* Route cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400">Your Routes</h3>

        {calculatingRoutes && calculatedRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-2">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <span className="text-slate-400">{searchPhase || 'Finding routes...'}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {calculatedRoutes.map((item, index) => (
              <RouteCard
                key={item.stop.id}
                item={item}
                index={index}
                isSelected={selectedRouteIndex === index}
                onSelect={() => {
                  const newIndex = selectedRouteIndex === index ? null : index
                  setSelectedRouteIndex(newIndex)
                  if (newIndex === null) setHoveredPoint(null)
                }}
                onHoverPoint={setHoveredPoint}
                onDownloadGPX={handleDownloadGPX}
                activity={activity}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generate more button */}
      {hasMoreRoutes && (
        <Button
          variant="primary"
          onClick={handleGenerateMore}
          disabled={calculatingRoutes}
          className="w-full"
        >
          {calculatingRoutes ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {searchPhase || 'Calculating...'}
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Generate More Routes
            </>
          )}
        </Button>
      )}

      {/* Start over */}
      <div className="pt-2">
        <Button variant="secondary" onClick={onReset} className="w-full">
          <RotateCcw className="w-4 h-4" />
          Start Over
        </Button>
      </div>
    </div>
  )
}

// Separate RouteCard component for better organization
const RouteCard = memo(function RouteCard({ item, index, isSelected, onSelect, onHoverPoint, onDownloadGPX, activity }) {
  return (
    <div
      className={`
        rounded-xl transition-all duration-300 overflow-hidden
        ${isSelected
          ? 'bg-slate-700/90 border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10'
          : 'bg-slate-700/50 border border-slate-600/50 hover:bg-slate-700/70'
        }
      `}
    >
      {/* Clickable header */}
      <button onClick={onSelect} className="w-full p-4 md:p-5 text-left">
        <div className="flex items-start gap-4">
          {/* Color indicator */}
          <div
            className={`w-3 rounded-full flex-shrink-0 transition-all ${isSelected ? 'min-h-[100px]' : 'min-h-[80px]'}`}
            style={{ backgroundColor: item.color }}
          />

          <div className="flex-1 min-w-0">
            {/* Station name with expand indicator */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">
                  {getStopIcon(item.stop.type)}
                </span>
                <h4 className="font-semibold text-white truncate">
                  {item.stop.name || 'Unnamed Stop'}
                </h4>
              </div>
              <div className={`text-slate-400 transition-transform ${isSelected ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>

            {/* Route Stats */}
            <div className="flex items-center gap-4 text-sm mb-3">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Route className="w-4 h-4 text-slate-400" />
                {formatDistance(item.route.distance)}
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <Clock className="w-4 h-4 text-slate-400" />
                {formatDuration(item.route.duration)}
              </span>
            </div>

            {/* Transit Journey Info - only show if transit info is available */}
            {!item.noTransitInfo && (
              <TransitJourneyInfo journey={item.transitJourney} stopName={item.stop.name} />
            )}
            {item.noTransitInfo && (
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-400">
                    Direct route to home
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isSelected && (
        <div className="px-4 pb-4 md:px-5 md:pb-5 space-y-4 border-t border-slate-600/30 pt-4">
          {/* Detailed Journey Legs - only if available */}
          {!item.noTransitInfo && item.transitJourney && (
            <TransitJourneyDetails journey={item.transitJourney} />
          )}

          {/* Elevation Profile */}
          <ElevationProfile
            route={item.route}
            color={item.color}
            onHoverPoint={onHoverPoint}
          />

          {/* GPX Download button */}
          <button
            onClick={(e) => onDownloadGPX(e, item)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                       bg-gradient-to-r from-green-500 to-emerald-600
                       text-white font-medium
                       hover:from-green-600 hover:to-emerald-700
                       transition-all duration-200 shadow-lg shadow-green-500/20"
          >
            <Download className="w-5 h-5" />
            Download GPX
          </button>

          {/* Activity reminder */}
          <p className="text-xs text-slate-500 text-center">
            {activity === 'run' ? '🏃 Running' : '🚴 Cycling'} route
            {item.noTransitInfo ? ' starting from this location' : ` from ${item.stop.name || 'transit stop'}`} to home
          </p>
        </div>
      )}
    </div>
  )
})

// Transit journey summary (collapsed view)
function TransitJourneyInfo({ journey, stopName }) {
  if (!journey || !journey.legs || journey.legs.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
        <div className="flex items-start gap-2">
          <Train className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-slate-300">
            Take public transit to {stopName}
          </p>
        </div>
      </div>
    )
  }

  // Get the transit legs (non-walking)
  const transitLegs = journey.legs.filter(leg => !leg.walking && leg.line)
  const firstLeg = transitLegs[0]
  const departureTime = journey.legs[0]?.origin?.departure

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
      <div className="flex items-start gap-2">
        <Train className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {departureTime && (
            <p className="text-xs text-slate-500 mb-1">
              Depart at {formatTime(departureTime)}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {transitLegs.slice(0, 4).map((leg, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300"
              >
                {getProductIcon(leg.line?.product)}
                {leg.line?.name}
              </span>
            ))}
          </div>
          {firstLeg?.line?.direction && (
            <p className="text-xs text-slate-400 mt-1">
              → {firstLeg.line.direction}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Detailed transit journey (expanded view)
function TransitJourneyDetails({ journey }) {
  if (!journey || !journey.legs || journey.legs.length === 0) {
    return null
  }

  return (
    <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
      <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
        <Train className="w-4 h-4" />
        Transit Details
      </h4>
      <div className="space-y-3">
        {journey.legs.map((leg, index) => (
          <div key={index} className="flex gap-3">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${leg.walking ? 'bg-slate-500' : 'bg-blue-500'}`} />
              {index < journey.legs.length - 1 && (
                <div className="w-0.5 flex-1 bg-slate-600 my-1" />
              )}
            </div>

            {/* Leg details */}
            <div className="flex-1 pb-2">
              {leg.walking ? (
                <div className="text-sm text-slate-400">
                  🚶 Walk {leg.distance ? `${Math.round(leg.distance)}m` : ''}
                  {leg.duration ? ` (${leg.duration} min)` : ''}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/30 text-blue-200">
                      {getProductIcon(leg.line?.product)}
                      {leg.line?.name}
                    </span>
                    {leg.line?.direction && (
                      <span className="text-xs text-slate-400">→ {leg.line.direction}</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="text-white">{formatTime(leg.origin?.departure)}</span>
                    {leg.origin?.departureDelay && leg.origin.departureDelay !== 0 && (
                      <span className={`ml-1 text-xs ${leg.origin.departureDelay > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatDelay(leg.origin.departureDelay)}
                      </span>
                    )}
                    <span className="text-slate-400"> {leg.origin?.name}</span>
                    {leg.origin?.platform && (
                      <span className="text-slate-500"> Pl. {leg.origin.platform}</span>
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="text-white">{formatTime(leg.destination?.arrival)}</span>
                    {leg.destination?.arrivalDelay && leg.destination.arrivalDelay !== 0 && (
                      <span className={`ml-1 text-xs ${leg.destination.arrivalDelay > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatDelay(leg.destination.arrivalDelay)}
                      </span>
                    )}
                    <span className="text-slate-400"> {leg.destination?.name}</span>
                    {leg.destination?.platform && (
                      <span className="text-slate-500"> Pl. {leg.destination.platform}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RouteResults
