import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Loader2, RotateCcw, Clock, Route, RefreshCw, MapPin, Navigation, Train, Download, ChevronDown, ChevronRight, AlertTriangle, X, Sun, Moon, TrendingUp, TrendingDown, Flame, Flag } from 'lucide-react'
import Button from '../ui/Button'
import MapLibreMap from '../MapLibreMap'
import ElevationProfile from '../ElevationProfile'
import { fetchNearbyStops, findJourneys, getStopIcon, getProductIcon, formatDelay, formatTime, getApiAvailability } from '../../services/deutschebahn'
import { calculateRoute } from '../../services/osrm'
import { filterByDirection, formatDistance, formatDuration, getDistanceTolerance } from '../../services/geo'
import { generateGPX, downloadGPX, generateFilename } from '../../services/gpx'
import { fetchElevationProfile, calculateElevationStats } from '../../services/elevation'

const ROUTES_PER_PAGE = 3
const ROUTE_COLORS = ['#3b82f6', '#10b981', '#f59e0b'] // blue, green, amber

// Default pace (min/km) for running/cycling
const DEFAULT_PACE = {
  run: 5.5, // 5:30 min/km
  bike: 3.0, // 3:00 min/km
}

/**
 * Generate waypoints for direct routes (when transit API is unavailable)
 */
function generateDirectRouteWaypoints({ homeLocation, distance, direction }) {
  const waypoints = []
  const distanceKm = distance
  const latOffset = distanceKm / 111
  const lngOffset = distanceKm / (111 * Math.cos(homeLocation.lat * Math.PI / 180))

  const directions = {
    north: { lat: latOffset, lng: 0, name: 'North' },
    northeast: { lat: latOffset * 0.707, lng: lngOffset * 0.707, name: 'Northeast' },
    east: { lat: 0, lng: lngOffset, name: 'East' },
    southeast: { lat: -latOffset * 0.707, lng: lngOffset * 0.707, name: 'Southeast' },
    south: { lat: -latOffset, lng: 0, name: 'South' },
    southwest: { lat: -latOffset * 0.707, lng: -lngOffset * 0.707, name: 'Southwest' },
    west: { lat: 0, lng: -lngOffset, name: 'West' },
    northwest: { lat: latOffset * 0.707, lng: -lngOffset * 0.707, name: 'Northwest' },
  }

  const selectedDirections = direction === 'any' || !direction
    ? ['north', 'east', 'south', 'west', 'northeast', 'southeast', 'southwest', 'northwest']
    : [direction]

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
        type: 'waypoint',
        products: null,
        distance: distanceKm * factor * 1000,
        isWaypoint: true,
      })
    })
  })

  waypoints.sort((a, b) => Math.abs(a.distance - distanceKm * 1000) - Math.abs(b.distance - distanceKm * 1000))
  return waypoints.slice(0, 20)
}

/**
 * Calculate estimated calories burned
 */
function calculateCalories(distanceKm, elevationGain = 0, activity = 'run') {
  const baseCalPerKm = activity === 'run' ? 60 : 35
  const terrainFactor = 1 + (elevationGain / 100) * 0.1
  return Math.round(distanceKm * baseCalPerKm * terrainFactor)
}

/**
 * Format pace as mm:ss
 */
function formatPace(paceMinPerKm) {
  const mins = Math.floor(paceMinPerKm)
  const secs = Math.round((paceMinPerKm - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate duration from distance and pace
 */
function calculateDuration(distanceKm, paceMinPerKm) {
  const totalMinutes = distanceKm * paceMinPerKm
  const hours = Math.floor(totalMinutes / 60)
  const mins = Math.round(totalMinutes % 60)
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins} min`
}

// ============================================
// Mini Card Component (Floating on map)
// ============================================
const RouteCardMini = memo(function RouteCardMini({ item, index, isSelected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(index)}
      className={`
        w-full text-left p-3 rounded-xl transition-all duration-200
        backdrop-blur-md border shadow-lg
        ${isSelected
          ? 'bg-slate-800/95 border-blue-500 ring-2 ring-blue-500/30'
          : 'bg-slate-800/80 border-slate-600/50 hover:bg-slate-800/90 hover:border-slate-500'
        }
      `}
    >
      <div className="flex items-center gap-3">
        {/* Color dot */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: item.color }}
        />
        {/* Station name */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm truncate">
            {item.stop.name || 'Unnamed Stop'}
          </h4>
          <p className="text-slate-400 text-xs">
            {formatDistance(item.route.distance)}
          </p>
        </div>
        {/* Arrow */}
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
      </div>
    </button>
  )
})

// ============================================
// Detail Panel Component (Slide out)
// ============================================
function RouteDetailPanel({
  item,
  onClose,
  onHoverPoint,
  onDownloadGPX,
  activity,
  pace,
  onPaceChange,
  darkMode,
  onToggleDarkMode,
  elevationProfile,
}) {
  const distanceKm = item.route.distance / 1000
  const elevationStats = elevationProfile ? calculateElevationStats(elevationProfile) : { gain: 0, loss: 0 }
  const duration = calculateDuration(distanceKm, pace)
  const calories = calculateCalories(distanceKm, elevationStats.gain, activity)

  // Calculate ETA
  const departureTime = item.transitJourney?.legs?.[0]?.origin?.departure
  let eta = null
  if (departureTime) {
    const depDate = new Date(departureTime)
    const transitDuration = item.transitJourney?.duration || 0
    const runDuration = distanceKm * pace * 60 * 1000 // ms
    eta = new Date(depDate.getTime() + transitDuration + runDuration)
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-white">Route Details</h2>
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Content (scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Station Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{getStopIcon(item.stop.type)}</span>
            <h3 className="text-lg font-semibold text-white">{item.stop.name}</h3>
          </div>
          {!item.noTransitInfo && item.transitJourney?.legs && (
            <p className="text-sm text-slate-400">
              {item.transitJourney.legs.filter(l => l.line).map(l => l.line.name).join(' → ')} • {departureTime && `Depart ${formatTime(departureTime)}`}
            </p>
          )}
        </div>

        {/* Pace Settings */}
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">⚙️ Your Pace</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPaceChange(Math.max(2, pace - 0.5))}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
              >
                -
              </button>
              <span className="text-white font-mono text-sm w-12 text-center">
                {formatPace(pace)}
              </span>
              <button
                onClick={() => onPaceChange(Math.min(10, pace + 0.5))}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
              >
                +
              </button>
              <span className="text-xs text-slate-500">min/km</span>
            </div>
          </div>
        </div>

        {/* Route Statistics Grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatBox icon={<Route className="w-4 h-4" />} label="Distance" value={formatDistance(item.route.distance)} />
          <StatBox icon={<Clock className="w-4 h-4" />} label="Duration" value={duration} />
          <StatBox icon={<TrendingUp className="w-4 h-4" />} label="Elevation ↑" value={`${elevationStats.gain} m`} />
          <StatBox icon={<TrendingDown className="w-4 h-4" />} label="Elevation ↓" value={`${elevationStats.loss} m`} />
          <StatBox icon={<Flame className="w-4 h-4" />} label="Calories" value={`~${calories} kcal`} />
          <StatBox icon={<Flag className="w-4 h-4" />} label="ETA" value={eta ? eta.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--'} />
        </div>

        {/* Elevation Profile */}
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <h4 className="text-sm font-medium text-slate-300 mb-2">📈 Elevation Profile</h4>
          <ElevationProfile
            route={item.route}
            color={item.color}
            onHoverPoint={onHoverPoint}
          />
        </div>

        {/* Transit Journey Details (if available) */}
        {!item.noTransitInfo && item.transitJourney && (
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-300 mb-2">🚇 Getting There</h4>
            <TransitJourneyDetails journey={item.transitJourney} />
          </div>
        )}

        {/* Edit Route Placeholder */}
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                     bg-slate-800/30 border border-slate-700/50 text-slate-500 cursor-not-allowed"
        >
          <span>✏️</span>
          Edit Route
          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">Soon</span>
        </button>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-700/50 space-y-2">
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
      </div>
    </div>
  )
}

// Stat box for the grid
function StatBox({ icon, label, value }) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-2 border border-slate-700/30">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-white font-medium text-sm">{value}</div>
    </div>
  )
}

// Transit journey details
function TransitJourneyDetails({ journey }) {
  if (!journey?.legs) return null

  return (
    <div className="space-y-2">
      {journey.legs.map((leg, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
            {leg.walking ? '🚶' : getProductIcon(leg.line?.product)}
          </div>
          <div className="flex-1 min-w-0">
            {leg.walking ? (
              <span className="text-slate-400">Walk {leg.distance ? `${Math.round(leg.distance)}m` : ''}</span>
            ) : (
              <>
                <span className="text-white font-medium">{leg.line?.name}</span>
                {leg.line?.direction && (
                  <span className="text-slate-400"> → {leg.line.direction}</span>
                )}
                {leg.origin?.departure && (
                  <span className="text-slate-500 text-xs ml-2">{formatTime(leg.origin.departure)}</span>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// Main RouteResults Component
// ============================================
function RouteResults({ state, updateState, onReset, dbApiAvailable }) {
  const [calculatingRoutes, setCalculatingRoutes] = useState(false)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(null)
  const [calculatedRoutes, setCalculatedRoutes] = useState([])
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [searchPhase, setSearchPhase] = useState('')
  const [noTransitMode, setNoTransitMode] = useState(false)
  const [elevationProfiles, setElevationProfiles] = useState({})
  const [darkMode, setDarkMode] = useState(false)
  const [pace, setPace] = useState(DEFAULT_PACE.run)
  const allStopsRef = useRef([])
  const searchedStopsRef = useRef(new Set())
  const isCalculatingRef = useRef(false)
  const hasInitializedRef = useRef(false)

  const { homeLocation, distance, activity, departureTime, direction, transitStops, isLoading, error } = state

  // Update pace when activity changes
  useEffect(() => {
    setPace(DEFAULT_PACE[activity] || DEFAULT_PACE.run)
  }, [activity])

  // Fetch nearby transit stops
  useEffect(() => {
    const loadTransitStops = async () => {
      updateState({ isLoading: true, error: null })
      const apiStatus = dbApiAvailable ?? getApiAvailability()

      if (apiStatus === false) {
        setNoTransitMode(true)
        setSearchPhase('Finding routes without transit info...')
        const waypoints = generateDirectRouteWaypoints({ homeLocation, distance, direction })
        updateState({ transitStops: waypoints, isLoading: false })
        return
      }

      setSearchPhase('Finding nearby stations...')

      try {
        const stops = await fetchNearbyStops({
          lat: homeLocation.lat,
          lng: homeLocation.lng,
          distance: Math.min(distance * 1000, 50000),
          results: 50,
        })

        const filteredStops = filterByDirection(stops, homeLocation.lat, homeLocation.lng, direction)
        const sorted = [...filteredStops].sort((a, b) => (a.distance || 0) - (b.distance || 0))
        allStopsRef.current = sorted
        searchedStopsRef.current = new Set()
        updateState({ transitStops: sorted, isLoading: false })
      } catch (err) {
        console.error('Failed to fetch transit stops:', err)
        setNoTransitMode(true)
        setSearchPhase('Transit API unavailable - finding direct routes...')
        const waypoints = generateDirectRouteWaypoints({ homeLocation, distance, direction })
        updateState({ transitStops: waypoints, isLoading: false })
      }
    }

    if (homeLocation && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      loadTransitStops()
    }
  }, [homeLocation, distance, direction, updateState, dbApiAvailable])

  // Calculate routes when transit stops are loaded
  useEffect(() => {
    if (transitStops.length === 0 || calculatedRoutes.length > 0 || isCalculatingRef.current) return

    const calculateInitialRoutes = async () => {
      if (isCalculatingRef.current) return
      isCalculatingRef.current = true
      setCalculatingRoutes(true)
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
          const route = await calculateRoute({
            startLat: stop.lat,
            startLng: stop.lng,
            endLat: homeLocation.lat,
            endLng: homeLocation.lng,
            profile: activity === 'run' ? 'foot' : 'bike',
          })

          if (route.distance >= minDistance && route.distance <= maxDistance) {
            let transitJourney = null

            if (!noTransitMode && !stop.isWaypoint) {
              setSearchPhase(`Finding transit to ${stop.name}...`)
              try {
                const journeyResult = await findJourneys({
                  from: { latitude: homeLocation.lat, longitude: homeLocation.lng, address: homeLocation.displayName || 'Home' },
                  to: stop.id,
                  departure: new Date(departureTime),
                  results: 1,
                })
                if (journeyResult.journeys?.length > 0) {
                  transitJourney = journeyResult.journeys[0]
                }
              } catch (journeyErr) {
                console.warn('Failed to fetch journey:', journeyErr)
              }
            }

            validRoutes.push({
              stop,
              route,
              color: ROUTE_COLORS[validRoutes.length % ROUTE_COLORS.length],
              transitJourney,
              noTransitInfo: noTransitMode || stop.isWaypoint,
            })
            setCalculatedRoutes([...validRoutes])
          }

          await new Promise(resolve => setTimeout(resolve, 150))
        } catch (err) {
          console.error(`Failed to calculate route for stop ${stop.id}:`, err)
        }
      }

      setCalculatingRoutes(false)
      setSearchPhase('')
      isCalculatingRef.current = false
    }

    calculateInitialRoutes()
  }, [transitStops])

  // Fetch elevation for selected route
  useEffect(() => {
    if (selectedRouteIndex === null) return
    const item = calculatedRoutes[selectedRouteIndex]
    if (!item || elevationProfiles[item.stop.id]) return

    const fetchElevation = async () => {
      try {
        const profile = await fetchElevationProfile(item.route.geometry.coordinates)
        setElevationProfiles(prev => ({ ...prev, [item.stop.id]: profile }))
      } catch (err) {
        console.warn('Failed to fetch elevation:', err)
      }
    }
    fetchElevation()
  }, [selectedRouteIndex, calculatedRoutes, elevationProfiles])

  const handleRouteClick = useCallback((index) => {
    setSelectedRouteIndex(prev => prev === index ? null : index)
    if (selectedRouteIndex === index) setHoveredPoint(null)
  }, [selectedRouteIndex])

  const handleDownloadGPX = useCallback(async (e, item) => {
    e.stopPropagation()
    let elevationProfile = elevationProfiles[item.stop.id]
    if (!elevationProfile) {
      try {
        elevationProfile = await fetchElevationProfile(item.route.geometry.coordinates)
        setElevationProfiles(prev => ({ ...prev, [item.stop.id]: elevationProfile }))
      } catch (err) {
        console.warn('Failed to fetch elevation for GPX:', err)
      }
    }
    const gpxContent = generateGPX(item.route, item.stop, homeLocation, activity, elevationProfile)
    const filename = generateFilename(item.stop.name, activity)
    downloadGPX(gpxContent, filename)
  }, [homeLocation, activity, elevationProfiles])

  const handleGenerateMore = useCallback(async () => {
    if (calculatingRoutes || isCalculatingRef.current) return
    isCalculatingRef.current = true
    setCalculatingRoutes(true)
    setSearchPhase('Finding more routes...')

    const { min: minDistance, max: maxDistance } = getDistanceTolerance(distance)
    const newRoutes = [...calculatedRoutes]
    let attempts = 0
    const maxAttempts = 20

    for (const stop of transitStops) {
      if (newRoutes.length >= calculatedRoutes.length + ROUTES_PER_PAGE) break
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
          if (!noTransitMode && !stop.isWaypoint) {
            try {
              const journeyResult = await findJourneys({
                from: { latitude: homeLocation.lat, longitude: homeLocation.lng, address: homeLocation.displayName || 'Home' },
                to: stop.id,
                departure: new Date(departureTime),
                results: 1,
              })
              if (journeyResult.journeys?.length > 0) {
                transitJourney = journeyResult.journeys[0]
              }
            } catch (err) {
              console.warn('Failed to fetch journey:', err)
            }
          }

          newRoutes.push({
            stop,
            route,
            color: ROUTE_COLORS[newRoutes.length % ROUTE_COLORS.length],
            transitJourney,
            noTransitInfo: noTransitMode || stop.isWaypoint,
          })
          setCalculatedRoutes([...newRoutes])
        }

        await new Promise(resolve => setTimeout(resolve, 150))
      } catch (err) {
        console.error(`Failed to calculate route:`, err)
      }
    }

    setCalculatingRoutes(false)
    setSearchPhase('')
    isCalculatingRef.current = false
  }, [calculatingRoutes, calculatedRoutes, transitStops, distance, homeLocation, activity, departureTime, noTransitMode])

  const hasMoreRoutes = transitStops.some(s => !searchedStopsRef.current.has(s.id))
  const selectedItem = selectedRouteIndex !== null ? calculatedRoutes[selectedRouteIndex] : null

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
          <p className="text-slate-300">{searchPhase || 'Finding routes...'}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900 p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-6 space-y-4">
          <div className="text-center text-red-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
            <h3 className="font-semibold text-lg">Something went wrong</h3>
            <p className="text-sm text-slate-400 mt-2">{error}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="primary" onClick={() => window.location.reload()} className="flex-1">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
            <Button variant="secondary" onClick={onReset} className="flex-1">
              <RotateCcw className="w-4 h-4" />
              Start Over
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 z-20">
        <Button variant="ghost" onClick={onReset} className="!px-3">
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline ml-2">Start Over</span>
        </Button>
        <h1 className="text-lg font-semibold text-white">Run Home</h1>
        <div className="w-20" /> {/* Spacer for centering */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Full-page Map */}
        <MapLibreMap
          center={[homeLocation.lng, homeLocation.lat]}
          zoom={11}
          marker={[homeLocation.lat, homeLocation.lng]}
          routes={calculatedRoutes}
          selectedRouteIndex={selectedRouteIndex}
          hoveredPoint={hoveredPoint}
          onRouteClick={handleRouteClick}
          darkMode={darkMode}
          className="absolute inset-0"
        />

        {/* Floating Route Cards (Desktop) */}
        <div className="absolute top-4 right-4 bottom-4 w-72 lg:w-80 flex-col gap-3 z-10 hidden md:flex">
          {/* Notice when transit API is unavailable */}
          {noTransitMode && (
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs backdrop-blur-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                Transit info unavailable
              </div>
            </div>
          )}

          {/* Route summary */}
          <div className="text-xs text-slate-400 bg-slate-900/70 backdrop-blur-md rounded-lg px-3 py-2">
            {calculatingRoutes ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                {searchPhase || 'Searching...'}
              </span>
            ) : (
              <span>{calculatedRoutes.length} routes found</span>
            )}
          </div>

          {/* Route cards */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {calculatedRoutes.map((item, index) => (
              <RouteCardMini
                key={item.stop.id}
                item={item}
                index={index}
                isSelected={selectedRouteIndex === index}
                onSelect={handleRouteClick}
              />
            ))}

            {/* Generate more button */}
            {hasMoreRoutes && !calculatingRoutes && (
              <button
                onClick={handleGenerateMore}
                className="w-full p-3 rounded-xl bg-slate-800/60 backdrop-blur-md border border-slate-600/50
                           text-slate-300 text-sm hover:bg-slate-800/80 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                More Routes
              </button>
            )}
          </div>
        </div>

        {/* Mobile Bottom Sheet (simplified for now) */}
        <div className="absolute bottom-0 left-0 right-0 md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 z-10">
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
            {calculatedRoutes.slice(0, 3).map((item, index) => (
              <RouteCardMini
                key={item.stop.id}
                item={item}
                index={index}
                isSelected={selectedRouteIndex === index}
                onSelect={handleRouteClick}
              />
            ))}
          </div>
        </div>

        {/* Detail Panel (slides in from right) */}
        {selectedItem && (
          <div className="absolute top-0 right-0 bottom-0 w-full md:w-96 z-20 animate-slide-in-right">
            <RouteDetailPanel
              item={selectedItem}
              onClose={() => setSelectedRouteIndex(null)}
              onHoverPoint={setHoveredPoint}
              onDownloadGPX={handleDownloadGPX}
              activity={activity}
              pace={pace}
              onPaceChange={setPace}
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(!darkMode)}
              elevationProfile={elevationProfiles[selectedItem.stop.id]}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default RouteResults
