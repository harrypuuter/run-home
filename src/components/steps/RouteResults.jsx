import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { Loader2, RotateCcw, Clock, Route, RefreshCw, MapPin, Navigation, Train, Download, ChevronDown, ChevronRight, AlertTriangle, X, TrendingUp, TrendingDown, Flame, Flag } from 'lucide-react'
import Button from '../ui/Button'
import MapLibreMap from '../MapLibreMap'
import ElevationProfile from '../ElevationProfile'
import RouteDetailPanel from './RouteDetailPanel'
import TransitJourneyDetails from './TransitJourneyDetails'
import MobileBottomSheet from '../../components/MobileBottomSheet'
import { findJourneys, getStopIcon, getProductIcon, formatDelay, formatTime } from '../../services/deutschebahn'
import { fetchOSMTransitStations } from '../../services/nominatim'
import { calculateRoute, calculateRouteWithWaypoints } from '../../services/osrm'
import { filterByDirection, formatDistance, formatDuration, getDistanceTolerance, getSearchRadii, TOLERANCE_LEVELS } from '../../services/geo'
import { generateGPX, downloadGPX, generateFilename } from '../../services/gpx'
import { fetchElevationProfile, calculateElevationStats } from '../../services/elevation'

// Configuration
const ROUTES_TARGET = 5  // Target number of routes to find
const ROUTE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] // blue, green, amber, red, purple
const MAX_CANDIDATES_PER_PASS = 30
const API_DELAY_MS = 150

// Default pace (min/km) for running/cycling
const DEFAULT_PACE = {
  run: 5.5, // 5:30 min/km
  bike: 3.0, // 3:00 min/km
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
        w-full text-left p-3 rounded-xl transition-all duration-200 transform-gpu
        backdrop-blur-md border shadow-lg
        ${isSelected
          ? 'bg-slate-800/95 border-blue-500 ring-2 ring-blue-500/30 scale-105 shadow-xl'
          : 'bg-slate-800/80 border-slate-600/50 hover:bg-slate-800/90 hover:border-slate-500 hover:scale-102'
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
// Main RouteResults Component
// ============================================
function RouteResults({ state, updateState, onReset, dbApiAvailable }) {
  const [calculatingRoutes, setCalculatingRoutes] = useState(false)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(null)

  // Allow selecting an initial route from debug state (debugSelectFirstRoute)
  useEffect(() => {
    if (state?.debugSelectFirstRoute) {
      setSelectedRouteIndex(0)
    }
  }, [state?.debugSelectFirstRoute])
  const [calculatedRoutes, setCalculatedRoutes] = useState([])
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [searchPhase, setSearchPhase] = useState('')
  const [currentTolerance, setCurrentTolerance] = useState(0) // 0 = 10%, 1 = 20%, 2 = 30%
  const [pace, setPace] = useState(DEFAULT_PACE.run)

  // Route editor state: per-route waypoints and edit mode
  const [routeEditors, setRouteEditors] = useState({})
  // Selected waypoint index (for highlighting)
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState(null)
  // Revision counter to force map updates when waypoints change
  const [mapRevision, setMapRevision] = useState(0)
  // Error message for max waypoints
  const [waypointError, setWaypointError] = useState(null)
  // Track if route needs recalculation (waypoints modified but not updated)
  const [routeNeedsUpdate, setRouteNeedsUpdate] = useState(false)

  // Compute mapRoutes with editor state merged in
  const mapRoutes = useMemo(() => {
    return calculatedRoutes.map((r, idx) => ({
      ...r,
      route: routeEditors[idx]?.tentativeRoute || r.route,
      editMode: !!routeEditors[idx]?.editMode,
      editableWaypoints: routeEditors[idx]?.waypoints || [],
    }))
  }, [calculatedRoutes, routeEditors])

  // Compute a key that changes when waypoints or routes change (forces MapLibreMap to update)
  const mapRoutesKey = useMemo(() => {
    const waypointCount = Object.values(routeEditors).reduce((sum, e) => sum + (e?.waypoints?.length || 0), 0)
    const routeDistances = Object.values(routeEditors).map(e => e?.tentativeRoute?.distance || 0).join(',')
    return `map-${waypointCount}-${routeDistances}`
  }, [routeEditors])

  const setRouteEditor = (routeIndex, updates) => {
    setRouteEditors(prev => {
      const newState = { ...(prev || {}), [routeIndex]: { ...(prev?.[routeIndex] || { waypoints: [], editMode: false, originalRoute: null, tentativeRoute: null }), ...updates } }
      return newState
    })
    // Bump revision to force map update
    setMapRevision(r => r + 1)
  }

  const getEditor = (routeIndex) => (routeEditors?.[routeIndex] || { waypoints: [], editMode: false, originalRoute: null, tentativeRoute: null })

  // Haversine helper (meters)
  const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000
    const toRad = (deg) => deg * (Math.PI / 180)
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Helper: compute nearest vertex index in a route geometry for a given point
  const findNearestVertexIndex = (coords, { lat, lng }) => {
    if (!coords || coords.length === 0) return 0
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < coords.length; i++) {
      const [clng, clat] = coords[i]
      const d = haversineDistance(lat, lng, clat, clng)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    return bestIdx
  }

  // Computes insertion index among current waypoints based on nearest vertex index
  const computeInsertionIndex = (routeCoords, currentWaypoints, point) => {
    const clickIdx = findNearestVertexIndex(routeCoords, point)
    // Map existing waypoints to their nearest vertex index
    const wpIndices = currentWaypoints.map(wp => findNearestVertexIndex(routeCoords, wp))
    // Count how many waypoints are before clickIdx
    let insertPos = 0
    for (const idx of wpIndices) {
      if (idx <= clickIdx) insertPos++
    }
    return insertPos
  }

  // Refs for tracking state across async operations
  const candidatesRef = useRef([])
  const checkedCandidatesRef = useRef(new Set())
  const isCalculatingRef = useRef(false)
  const hasInitializedRef = useRef(false)

  const { homeLocation, distance, activity, departureTime, direction, isLoading, error } = state

  // Keep a ref to the currently selected route index so test helpers and async
  // closures can act on the most-recent selection without stale closures.
  const selectedRouteRef = useRef(null)
  useEffect(() => { selectedRouteRef.current = selectedRouteIndex }, [selectedRouteIndex])

  // Helper to call OSRM with start + waypoints + end and set tentative route
  // Accepts optional waypoints param to avoid stale state issues (React state is async)
  const computeTentativeRoute = async (routeIndex, waypointsOverride = null) => {
    const editor = getEditor(routeIndex)
    const item = calculatedRoutes[routeIndex]
    if (!item) return

    // Use override if provided, otherwise fall back to editor state
    const waypoints = waypointsOverride !== null ? waypointsOverride : (editor.waypoints || [])

    // Build coords array: [stop, ...waypoints, home]
    const start = { lat: item.stop.lat, lng: item.stop.lng }
    const end = { lat: homeLocation.lat, lng: homeLocation.lng }
    const coords = [start, ...waypoints, end]

    try {
      const route = await calculateRouteWithWaypoints({ coords, profile: activity === 'bike' ? 'bike' : 'foot' })
      // Update both waypoints and tentativeRoute together to avoid race conditions
      setRouteEditor(routeIndex, { waypoints, tentativeRoute: route })
    } catch (err) {
      console.error('[Editor] Failed to compute tentative route:', err)
      // Do not throw - just keep prior tentative if any
    }
  }

  // Toggle edit mode, storing original route snapshot when entering
  const toggleEditMode = (routeIndex) => {
    const editor = getEditor(routeIndex)
    if (!editor.editMode) {
      // entering edit mode
      setRouteEditor(routeIndex, { editMode: true, originalRoute: calculatedRoutes[routeIndex]?.route || null, waypoints: [], tentativeRoute: null })
      setSelectedWaypointIndex(null)
    } else {
      // exiting edit mode
      setRouteEditor(routeIndex, { editMode: false, waypoints: editor.waypoints || [], tentativeRoute: null })
      setSelectedWaypointIndex(null)
    }
  }

  // Add waypoint (insert at nearest segment) - just adds marker, no route calculation
  const addWaypoint = (routeIndex, wp) => {
    const editor = getEditor(routeIndex)
    const item = calculatedRoutes[routeIndex]
    if (!item) return

    // Clear any previous error
    setWaypointError(null)

    const maxWaypoints = 6
    if ((editor.waypoints || []).length >= maxWaypoints) {
      setWaypointError(`Maximum ${maxWaypoints} waypoints allowed. Remove a waypoint before adding more.`)
      setTimeout(() => setWaypointError(null), 4000)
      return
    }

    const routeCoords = (editor.tentativeRoute?.geometry?.coordinates || item.route?.geometry?.coordinates) || []
    const insertionIndex = computeInsertionIndex(routeCoords, editor.waypoints || [], wp)

    const newWaypoints = [...(editor.waypoints || [])]
    newWaypoints.splice(insertionIndex, 0, wp)

    // Only update waypoints - route calculation is manual via "Update Route" button
    setRouteEditor(routeIndex, { waypoints: newWaypoints })
    setRouteNeedsUpdate(true)
  }

  const removeWaypoint = (routeIndex, idx) => {
    const editor = getEditor(routeIndex)
    if (!editor) return
    const newWaypoints = [...(editor.waypoints || [])]
    newWaypoints.splice(idx, 1)
    setRouteEditor(routeIndex, { waypoints: newWaypoints })
    setRouteNeedsUpdate(true)
    // Clear selection if we removed the selected waypoint
    if (selectedWaypointIndex === idx) {
      setSelectedWaypointIndex(null)
    } else if (selectedWaypointIndex !== null && idx < selectedWaypointIndex) {
      setSelectedWaypointIndex(selectedWaypointIndex - 1)
    }
  }

  // Manual route update - called when user clicks "Update Route" button
  const updateRoute = async (routeIndex) => {
    const editor = getEditor(routeIndex)
    if (!editor) return
    await computeTentativeRoute(routeIndex, editor.waypoints)
    setRouteNeedsUpdate(false)
  }

  const selectWaypoint = (idx) => {
    setSelectedWaypointIndex(prev => prev === idx ? null : idx)
  }

  const saveWaypoints = async (routeIndex) => {
    const editor = getEditor(routeIndex)
    const item = calculatedRoutes[routeIndex]
    if (!editor || !item) return

    // If tentative route missing, compute it
    if (!editor.tentativeRoute) {
      await computeTentativeRoute(routeIndex)
    }

    const final = getEditor(routeIndex).tentativeRoute || editor.originalRoute || item.route

    // Apply final route into calculatedRoutes (immutably)
    setCalculatedRoutes(prev => {
      const copy = [...prev]
      copy[routeIndex] = { ...copy[routeIndex], route: final }
      return copy
    })

    // Exit edit mode and clear editor
    setRouteEditor(routeIndex, { editMode: false, waypoints: [], originalRoute: null, tentativeRoute: null })
  }

  const cancelEditing = (routeIndex) => {
    // Discard changes and exit edit mode
    setRouteEditor(routeIndex, { editMode: false, waypoints: [], tentativeRoute: null, originalRoute: null })
  }

  // Update pace when activity changes
  useEffect(() => {
    setPace(DEFAULT_PACE[activity] || DEFAULT_PACE.run)
  }, [activity])

  // ============================================
  // STEP 2: Find candidate start points (OSM only)
  // ============================================
  useEffect(() => {
    if (!homeLocation || hasInitializedRef.current) return
    hasInitializedRef.current = true

    // Expose a debug helper for selecting a route (only in development/debug pages)
    try {
      // Expose a helper that allows selecting a route programmatically from tests.
      window.__runhome_selectRoute = (index) => {
        console.log('[E2E helper] selectRoute called for', index)
        setSelectedRouteIndex(index)
        // Keep the component-level ref in sync immediately for helpers
        selectedRouteRef.current = index
      }

      // Expose helpers for E2E tests (with logging to help debugging in CI)
      window.__runhome_addWaypoint = (routeIndex, wp) => {
        console.log('[E2E helper] addWaypoint called for route', routeIndex, wp)
        return addWaypoint(routeIndex, wp)
      }
      window.__runhome_addWaypointCurrent = async (wp) => {
        const idx = (selectedRouteRef.current != null) ? selectedRouteRef.current : 0
        console.log('[E2E helper] addWaypointCurrent called; selectedRouteIndex=', selectedRouteRef.current, 'using', idx, wp)
        // Ensure edit mode is enabled before adding (helps tests/manual helpers)
        const editor = getEditor(idx)
        if (!editor.editMode) {
          console.log('[E2E helper] edit mode not enabled for route', idx, 'enabling now')
          toggleEditMode(idx)
          // Small delay to let UI update
          await new Promise(r => setTimeout(r, 120))
        }
        return addWaypoint(idx, wp)
      }
      window.__runhome_toggleEdit = (routeIndex) => {
        console.log('[E2E helper] toggleEdit called for', routeIndex)
        return toggleEditMode(routeIndex)
      }
      window.__runhome_toggleEditCurrent = () => {
        const idx = (selectedRouteRef.current != null) ? selectedRouteRef.current : 0
        console.log('[E2E helper] toggleEditCurrent called; selectedRouteIndex=', selectedRouteRef.current, 'using', idx)
        return toggleEditMode(idx)
      }

      // A safe helper that waits briefly for the route to be available and editMode to be enabled
      window.__runhome_addWaypointSafe = async (wp, opts = { retries: 8, delayMs: 120 }) => {
        const idx = (selectedRouteRef.current != null) ? selectedRouteRef.current : 0
        console.log('[E2E helper] addWaypointSafe called for', wp, 'routeIdx=', idx)
        let tries = 0
        while (tries < opts.retries) {
          const item = calculatedRoutes[idx]
          const editor = getEditor(idx)
          if (item && editor && editor.editMode) {
            console.log('[E2E helper] route and editor ready; adding waypoint')
            return addWaypoint(idx, wp)
          }
          // If editor not in edit mode, try enabling it
          if (editor && !editor.editMode) {
            console.log('[E2E helper] editor not in editMode; enabling')
            toggleEditMode(idx)
          }
          await new Promise(r => setTimeout(r, opts.delayMs))
          tries++
        }
        console.warn('[E2E helper] addWaypointSafe timed out waiting for route/editor to be ready')
      }
    } catch (e) {
      // ignore in non-browser environments
    }

    // Debug: seed routes list if provided in state.debugSeedRoutes (useful for deterministic tests)
    if (state?.debugSeedRoutes && Array.isArray(state.debugSeedRoutes) && state.debugSeedRoutes.length > 0) {
      console.log('[Debug] Using debugSeedRoutes to short-circuit route search')
      const seeded = state.debugSeedRoutes.map((r, i) => ({
        ...r,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        noTransitInfo: true,
        transitJourney: null,
      }))
      setCalculatedRoutes(seeded)
      updateState({ isLoading: false })

      // If debug requests selecting the first route, dispatch a small delay then select it
      if (state.debugSelectFirstRoute) {
        setTimeout(() => {
          setSelectedRouteIndex(0)
          // Also clear the flag to avoid repeated behavior
          updateState({ debugSelectFirstRoute: false })
        }, 50)
      }

      return
    }

    const findCandidates = async () => {
      updateState({ isLoading: true, error: null })
      setSearchPhase('Finding nearby stations...')

      try {
        // Calculate annulus radii based on target distance
        const { innerRadius, outerRadius } = getSearchRadii(distance)
        console.log('[Algorithm] Search annulus:', innerRadius, '-', outerRadius, 'm')

        // Fetch stations from OSM Overpass API
        const stations = await fetchOSMTransitStations({
          lat: homeLocation.lat,
          lng: homeLocation.lng,
          innerRadius,
          outerRadius,
        })

        // Filter by direction
        const filtered = filterByDirection(stations, homeLocation.lat, homeLocation.lng, direction)
        console.log('[Algorithm] Found', filtered.length, 'candidates after direction filter')

        if (filtered.length === 0) {
          updateState({
            isLoading: false,
            error: 'No transit stations found in the selected area and direction. Try a different distance or direction.'
          })
          return
        }

        // Sort by distance from target (prefer stations that will give routes close to target)
        const targetDistance = distance * 1000
        const sorted = [...filtered].sort((a, b) => {
          const aDiff = Math.abs(a.distance - targetDistance)
          const bDiff = Math.abs(b.distance - targetDistance)
          return aDiff - bDiff
        })

        candidatesRef.current = sorted
        checkedCandidatesRef.current = new Set()
        updateState({ isLoading: false })

        // Proceed to route calculation
        calculateRoutes(sorted, 0)
      } catch (err) {
        console.error('[Algorithm] Failed to find candidates:', err)
        if (err && err.name === 'OverpassRateLimit') {
          updateState({ isLoading: false, error: 'The Overpass API is currently rate-limiting requests. Please wait a few minutes and try again.' })
        } else {
          updateState({ isLoading: false, error: 'Failed to find nearby stations. Please try again.' })
        }
      }
    }

    findCandidates()
  }, [homeLocation, distance, direction, updateState])

  // ============================================
  // STEP 3: Calculate routes with adaptive tolerance
  // ============================================
  const calculateRoutes = useCallback(async (candidates, toleranceLevel) => {
    if (isCalculatingRef.current) return
    isCalculatingRef.current = true
    setCalculatingRoutes(true)
    setCurrentTolerance(toleranceLevel)
    setSearchPhase(`Calculating routes (±${(toleranceLevel + 1) * 10}% tolerance)...`)

    const { min: minDistance, max: maxDistance, tolerance } = getDistanceTolerance(distance, toleranceLevel)
    console.log('[Algorithm] Tolerance level', toleranceLevel, '- range:', minDistance, '-', maxDistance, 'm')

    const validRoutes = [...calculatedRoutes]
    let attempts = 0

    for (const candidate of candidates) {
      // Stop if we have enough routes
      if (validRoutes.length >= ROUTES_TARGET) break
      // Stop if we've tried too many
      if (attempts >= MAX_CANDIDATES_PER_PASS) break
      // Skip already checked candidates
      if (checkedCandidatesRef.current.has(candidate.id)) continue

      attempts++
      checkedCandidatesRef.current.add(candidate.id)
      setSearchPhase(`Checking ${candidate.name}...`)

      try {
        const route = await calculateRoute({
          startLat: candidate.lat,
          startLng: candidate.lng,
          endLat: homeLocation.lat,
          endLng: homeLocation.lng,
          profile: activity === 'run' ? 'foot' : 'bike',
        })

        const isValid = route.distance >= minDistance && route.distance <= maxDistance
        console.log('[Algorithm] Route to', candidate.name, '-', route.distance, 'm, valid:', isValid)

        if (isValid) {
          validRoutes.push({
            stop: candidate,
            route,
            color: ROUTE_COLORS[validRoutes.length % ROUTE_COLORS.length],
            transitJourney: null, // Lazy loaded when selected
            noTransitInfo: true, // Will be updated when transit is fetched
          })
          setCalculatedRoutes([...validRoutes])
        }

        // Rate limit API calls
        await new Promise(resolve => setTimeout(resolve, API_DELAY_MS))
      } catch (err) {
        console.error('[Algorithm] Route calculation failed for', candidate.name, err)
      }
    }

    setCalculatingRoutes(false)
    setSearchPhase('')
    isCalculatingRef.current = false

    // If we don't have enough routes and can relax tolerance, try again
    if (validRoutes.length < ROUTES_TARGET && toleranceLevel < TOLERANCE_LEVELS.length - 1) {
      console.log('[Algorithm] Not enough routes, relaxing tolerance...')
      // Small delay before retrying with looser tolerance
      setTimeout(() => {
        calculateRoutes(candidates, toleranceLevel + 1)
      }, 100)
    } else if (validRoutes.length === 0) {
      updateState({ error: 'No suitable routes found. Try adjusting your distance or direction.' })
    }
  }, [calculatedRoutes, distance, homeLocation, activity, updateState])

  // ============================================
  // STEP 5b: Lazy load transit directions when route selected
  // ============================================
  const fetchTransitForRoute = useCallback(async (routeIndex) => {
    if (!dbApiAvailable) return

    const route = calculatedRoutes[routeIndex]
    if (!route || route.transitJourney !== null) return // Already fetched or has data

    try {
      console.log('[Transit] Fetching directions to', route.stop.name)
      const journeyResult = await findJourneys({
        from: {
          latitude: homeLocation.lat,
          longitude: homeLocation.lng,
          address: homeLocation.displayName || 'Home'
        },
        to: {
          latitude: route.stop.lat,
          longitude: route.stop.lng,
          name: route.stop.name
        },
        departure: new Date(departureTime),
        results: 1,
      })

      if (journeyResult.journeys?.length > 0) {
        const updatedRoutes = [...calculatedRoutes]
        updatedRoutes[routeIndex] = {
          ...updatedRoutes[routeIndex],
          transitJourney: journeyResult.journeys[0],
          noTransitInfo: false,
        }
        setCalculatedRoutes(updatedRoutes)
      }
    } catch (err) {
      console.warn('[Transit] Failed to fetch directions:', err)
      // Silently fail - transit directions are optional
    }
  }, [calculatedRoutes, homeLocation, departureTime, dbApiAvailable])

  // ============================================
  // Event Handlers

  // Editor handlers - simplified handlers removed; use the richer implementations above (addWaypoint/moveWaypoint/saveWaypoints/cancelEditing)

  // ============================================
  const handleRouteClick = useCallback((index) => {
    // Compute the next selected index deterministically and act on it immediately
    setSelectedRouteIndex(prev => {
      const next = prev === index ? null : index

      if (next === null) {
        // Panel closing - clear hover and transit overlay
        setHoveredPoint(null)
        setShowTransitOnMap(false)
      } else {
        // Panel opening - lazy load transit
        fetchTransitForRoute(next)
      }

      return next
    })
  }, [fetchTransitForRoute])

  const handleDownloadGPX = useCallback(async (e, item) => {
    e.stopPropagation()
    let elevationProfile = null
    try {
      elevationProfile = await fetchElevationProfile(item.route.geometry.coordinates)
    } catch (err) {
      console.warn('Failed to fetch elevation for GPX:', err)
    }
    const gpxContent = generateGPX(item.route, item.stop, homeLocation, activity, elevationProfile)
    const filename = generateFilename(item.stop.name, activity)
    downloadGPX(gpxContent, filename)
  }, [homeLocation, activity])

  const handleGenerateMore = useCallback(async () => {
    console.log('[RouteResults] Find More clicked - calculatingRoutes:', calculatingRoutes, 'candidates left:', candidatesRef.current.length)
    if (calculatingRoutes || isCalculatingRef.current) return
    // Continue calculating with remaining candidates at current tolerance
    calculateRoutes(candidatesRef.current, currentTolerance)
  }, [calculatingRoutes, calculateRoutes, currentTolerance])

  const hasMoreCandidates = candidatesRef.current.some(c => !checkedCandidatesRef.current.has(c.id))
  const [showTransitOnMap, setShowTransitOnMap] = useState(false)

  // Ensure overlay is cleared if the DB API becomes unavailable
  useEffect(() => {
    if (!dbApiAvailable && showTransitOnMap) {
      setShowTransitOnMap(false)
    }
  }, [dbApiAvailable, showTransitOnMap])

  const selectedItem = selectedRouteIndex !== null
    ? {
        ...calculatedRoutes[selectedRouteIndex],
        // Prefer tentative route when editing
        route: routeEditors[selectedRouteIndex]?.tentativeRoute || calculatedRoutes[selectedRouteIndex]?.route,
      }
    : null

  // Compute transit overlay GeoJSON for selected route when requested
  const transitOverlay = (function() {
    // Only provide overlay if DB API is available and user requested it
    if (!dbApiAvailable) return null
    if (!selectedItem || !showTransitOnMap || !selectedItem.transitJourney) return null

    const coords = []
    // Use leg origin/destination locations if available
    selectedItem.transitJourney.legs.forEach((leg) => {
      const originLoc = leg.origin?.location
      const destLoc = leg.destination?.location
      if (originLoc && typeof originLoc.latitude === 'number' && typeof originLoc.longitude === 'number') {
        coords.push([originLoc.longitude, originLoc.latitude])
      }
      if (destLoc && typeof destLoc.latitude === 'number' && typeof destLoc.longitude === 'number') {
        coords.push([destLoc.longitude, destLoc.latitude])
      }
    })

    if (coords.length < 2) return null

    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
      properties: {},
    }
  })()


  // Loading state - show when loading or when still calculating initial routes
  if (isLoading || (calculatingRoutes && calculatedRoutes.length === 0)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
          <p className="text-slate-300">{searchPhase || 'Finding routes...'}</p>
        </div>
      </div>
    )
  }

  // Guard against missing homeLocation
  if (!homeLocation || typeof homeLocation.lat !== 'number' || typeof homeLocation.lng !== 'number') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <p className="text-slate-300">Home location not set</p>
          <Button variant="secondary" onClick={onReset}>
            Start Over
          </Button>
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
          key="main-map"
          center={[homeLocation.lng, homeLocation.lat]}
          zoom={11}
          marker={[homeLocation.lat, homeLocation.lng]}
          routes={mapRoutes}
          selectedRouteIndex={selectedRouteIndex}
          hoveredPoint={hoveredPoint}
          highlightedWaypointIndex={selectedWaypointIndex}
          mapRevision={mapRevision}
          onRouteClick={handleRouteClick}
          className="absolute inset-0"
          transitOverlay={transitOverlay}
          transitColor={selectedItem?.color}
          onAddWaypoint={(wp) => {
            if (selectedRouteIndex !== null) addWaypoint(selectedRouteIndex, wp)
          }}
        />


        {/* Floating Route Cards (Desktop) - hide when detail panel is open */}
        <div
          className={`absolute top-4 right-4 bottom-4 flex-col gap-3 z-10 hidden md:flex transition-opacity duration-200 ${selectedRouteIndex !== null ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          style={{ width: '35%', minWidth: '320px', maxWidth: '480px' }}
        >
          {/* Route summary */}
          <div className="text-xs text-slate-400 bg-slate-900/70 backdrop-blur-md rounded-lg px-3 py-2">
            {calculatingRoutes ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                {searchPhase || 'Searching...'}
              </span>
            ) : (
              <span>
                {calculatedRoutes.length} route{calculatedRoutes.length !== 1 ? 's' : ''} found
                {currentTolerance > 0 && ` (±${(currentTolerance + 1) * 10}% tolerance)`}
              </span>
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
            {hasMoreCandidates && !calculatingRoutes && (
              <button
                onClick={handleGenerateMore}
                className="w-full p-3 rounded-xl bg-slate-800/60 backdrop-blur-md border border-slate-600/50
                           text-slate-300 text-sm hover:bg-slate-800/80 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Find More Routes
              </button>
            )}
          </div>
        </div>

        {/* Mobile Bottom Sheet */}
        <MobileBottomSheet
          routes={calculatedRoutes}
          selectedRouteIndex={selectedRouteIndex}
          onSelect={handleRouteClick}
          onClose={() => setSelectedRouteIndex(null)}
          showTransitOnMap={showTransitOnMap}
          onToggleShowTransit={() => setShowTransitOnMap(s => !s)}
          activity={activity}
          pace={pace}
          onPaceChange={setPace}
          onDownloadGPX={handleDownloadGPX}
          onHoverPoint={setHoveredPoint}
          dbApiAvailable={dbApiAvailable}
          // new props for mobile find more
          hasMoreCandidates={hasMoreCandidates}
          calculatingRoutes={calculatingRoutes}
          onGenerateMore={handleGenerateMore}
        />

        {/* Detail Panel (slides in from right) */}
        {selectedItem && (
          <div className="absolute top-0 right-0 bottom-0 w-full z-20 animate-slide-in-right" style={{ width: 'min(100%, max(35%, 400px))' }}>
            <RouteDetailPanel
              item={selectedItem}
              onClose={() => { setSelectedRouteIndex(null); setShowTransitOnMap(false) }}
              onHoverPoint={setHoveredPoint}
              onDownloadGPX={handleDownloadGPX}
              activity={activity}
              pace={pace}
              onPaceChange={setPace}
              showTransitOnMap={showTransitOnMap}
              onToggleShowTransit={() => setShowTransitOnMap(s => !s)}
              dbApiAvailable={dbApiAvailable}
              homeLocation={homeLocation}
              // Editor props
              editMode={routeEditors[selectedRouteIndex]?.editMode}
              waypoints={routeEditors[selectedRouteIndex]?.waypoints || []}
              selectedWaypointIndex={selectedWaypointIndex}
              waypointError={waypointError}
              routeNeedsUpdate={routeNeedsUpdate}
              tentativeRoute={routeEditors[selectedRouteIndex]?.tentativeRoute}
              onToggleEdit={() => toggleEditMode(selectedRouteIndex)}
              onRemoveWaypoint={(idx) => removeWaypoint(selectedRouteIndex, idx)}
              onSelectWaypoint={selectWaypoint}
              onUpdateRoute={() => updateRoute(selectedRouteIndex)}
              onSave={() => saveWaypoints(selectedRouteIndex)}
              onCancel={() => cancelEditing(selectedRouteIndex)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default RouteResults
