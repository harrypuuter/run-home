import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchElevationProfile, calculateElevationStats } from '../services/elevation'

/**
 * Modern elevation profile component using Canvas for smooth rendering
 * Clean, minimal design that fits the new MapLibre layout
 */
function ElevationProfile({ route, color = '#3b82f6', onHoverPoint, height = 120, waypoints = [] }) {
  console.log('[ElevationProfile] Component rendering, route prop:', route ? 'exists' : 'null/undefined')

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hoveredData, setHoveredData] = useState(null)
  // Initialize with a reasonable default width to prevent initial render issues
  const [dimensions, setDimensions] = useState({ width: 300, height })

  // Create a stable identifier for the route to detect changes
  const routeHash = route?.geometry?.coordinates 
    ? `${route.distance || 0}-${route.geometry.coordinates.length}-${route.geometry.coordinates[0]?.[0]?.toFixed(4)}-${route.geometry.coordinates[route.geometry.coordinates.length-1]?.[0]?.toFixed(4)}`
    : null

  // Fetch elevation data
  useEffect(() => {
    console.log('[ElevationProfile] useEffect triggered, routeHash:', routeHash)

    const loadElevation = async () => {
      console.log('[ElevationProfile] loadElevation called')
      console.log('[ElevationProfile] route.geometry:', route?.geometry ? 'exists' : 'missing')
      console.log('[ElevationProfile] coordinates:', route?.geometry?.coordinates?.length || 0, 'points')

      if (!route?.geometry?.coordinates) {
        console.log('[ElevationProfile] No route data, setting error')
        setLoading(false)
        setError('No route data')
        return
      }

      setLoading(true)
      setError(null)

      try {
        console.log('[ElevationProfile] Fetching elevation for', route.geometry.coordinates.length, 'coordinates')
        const data = await fetchElevationProfile(route.geometry.coordinates)
        console.log('[ElevationProfile] API returned', data?.length || 0, 'points')

        // Filter valid points and interpolate missing values
        let processedData = data.map((p, i, arr) => {
          if (p.elevation !== null) return p

          // Try to interpolate from neighbors
          let prevElev = null
          let nextElev = null

          for (let j = i - 1; j >= 0; j--) {
            if (arr[j].elevation !== null) {
              prevElev = arr[j].elevation
              break
            }
          }

          for (let j = i + 1; j < arr.length; j++) {
            if (arr[j].elevation !== null) {
              nextElev = arr[j].elevation
              break
            }
          }

          if (prevElev !== null && nextElev !== null) {
            return { ...p, elevation: (prevElev + nextElev) / 2 }
          } else if (prevElev !== null) {
            return { ...p, elevation: prevElev }
          } else if (nextElev !== null) {
            return { ...p, elevation: nextElev }
          }

          return p
        })

        // Now filter for valid data
        const validData = processedData.filter(p => p.elevation !== null)

        console.log('[ElevationProfile] Raw data points:', data.length,
                    'Valid after interpolation:', validData.length)

        if (validData.length < 2) {
          // If API failed completely, generate synthetic profile based on distance
          console.warn('[ElevationProfile] No valid elevation data, using flat profile')
          const syntheticData = data.map(p => ({
            ...p,
            elevation: 100, // Flat profile at 100m as fallback
          }))
          setProfile(syntheticData)
        } else {
          setProfile(validData)
        }
      } catch (err) {
        console.error('Failed to load elevation:', err)
        setError('Could not load elevation')
      } finally {
        setLoading(false)
      }
    }

    loadElevation()
  }, [routeHash])

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const width = container.clientWidth
      if (width > 0) {
        setDimensions({ width, height })
      }
    }

    // Initial size - use multiple frames to ensure layout is complete
    requestAnimationFrame(() => {
      updateDimensions()
      // Double-check after another frame in case layout wasn't ready
      requestAnimationFrame(updateDimensions)
    })

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setDimensions({
            width: entry.contentRect.width,
            height,
          })
        }
      }
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [height])

  // Draw the elevation profile on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    console.log('[ElevationProfile] Draw effect - canvas:', !!canvas, 'profile:', profile?.length, 'dimensions:', dimensions)

    if (!canvas || !container || !profile || profile.length < 2 || dimensions.width === 0) {
      console.log('[ElevationProfile] Skipping draw - missing requirements')
      return
    }

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    // Use container's actual dimensions for accurate rendering
    const displayWidth = container.clientWidth
    const displayHeight = height

    // Set canvas bitmap size with DPR for crisp rendering
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr

    // Reset transform and scale for DPR
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // Use display dimensions for drawing (not dimensions state which may be stale)
    const width = displayWidth

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Calculate bounds
    const elevations = profile.map(p => p.elevation)
    const minElev = Math.min(...elevations)
    const maxElev = Math.max(...elevations)
    const elevRange = maxElev - minElev || 1
    const maxDistance = profile[profile.length - 1].distance

    // Padding
    const padding = { top: 10, right: 10, bottom: 25, left: 40 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Helper to convert data to canvas coords
    const toX = (distance) => padding.left + (distance / maxDistance) * chartWidth
    const toY = (elevation) => padding.top + chartHeight - ((elevation - minElev) / elevRange) * chartHeight

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'
    ctx.lineWidth = 1

    // Horizontal grid (elevation)
    const elevSteps = 4
    for (let i = 0; i <= elevSteps; i++) {
      const y = padding.top + (chartHeight / elevSteps) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
    }

    // Draw the filled area under the curve
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom)
    gradient.addColorStop(0, `${color}40`)
    gradient.addColorStop(1, `${color}05`)

    ctx.beginPath()
    ctx.moveTo(toX(0), height - padding.bottom)

    profile.forEach((point, i) => {
      const x = toX(point.distance)
      const y = toY(point.elevation)
      if (i === 0) {
        ctx.lineTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.lineTo(toX(maxDistance), height - padding.bottom)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw the line
    ctx.beginPath()
    profile.forEach((point, i) => {
      const x = toX(point.distance)
      const y = toY(point.elevation)
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Draw axis labels
    ctx.fillStyle = '#64748b'
    ctx.font = '10px Inter, system-ui, sans-serif'

    // Y-axis labels (elevation)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= elevSteps; i++) {
      const elev = minElev + (elevRange / elevSteps) * (elevSteps - i)
      const y = padding.top + (chartHeight / elevSteps) * i
      ctx.fillText(`${Math.round(elev)}m`, padding.left - 5, y)
    }

    // X-axis labels (distance) - use whole km values
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const distKm = maxDistance / 1000
    const maxKm = Math.ceil(distKm)
    // Calculate a nice step size (1, 2, 5, or 10 km) based on total distance
    let kmStep = 1
    if (maxKm > 20) kmStep = 5
    else if (maxKm > 10) kmStep = 2

    for (let km = 0; km <= maxKm; km += kmStep) {
      const dist = km * 1000
      if (dist > maxDistance) break
      const x = toX(dist)
      ctx.fillText(`${km}`, x, height - padding.bottom + 5)
    }

    // Draw "km" label at end
    ctx.textAlign = 'left'
    ctx.fillText('km', width - padding.right + 5, height - padding.bottom + 5)

    // Draw waypoint markers as vertical lines
    if (waypoints && waypoints.length > 0 && route?.geometry?.coordinates) {
      const routeCoords = route.geometry.coordinates
      
      waypoints.forEach((wp, wpIndex) => {
        // Find the closest point on the route to this waypoint
        let closestDist = Infinity
        let closestRouteIndex = 0
        
        for (let i = 0; i < routeCoords.length; i++) {
          const [lng, lat] = routeCoords[i]
          const dist = Math.sqrt(Math.pow(lng - wp.lng, 2) + Math.pow(lat - wp.lat, 2))
          if (dist < closestDist) {
            closestDist = dist
            closestRouteIndex = i
          }
        }
        
        // Find the corresponding distance in the profile
        // Profile points are sampled from route, so we need to interpolate
        const routeProgress = closestRouteIndex / (routeCoords.length - 1)
        const wpDistance = routeProgress * maxDistance
        const x = toX(wpDistance)
        
        // Draw dashed vertical line
        ctx.beginPath()
        ctx.setLineDash([4, 4])
        ctx.moveTo(x, padding.top)
        ctx.lineTo(x, height - padding.bottom)
        ctx.strokeStyle = '#f59e0b' // Amber color matching waypoint markers
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.setLineDash([]) // Reset dash
        
        // Draw waypoint number label at top
        ctx.fillStyle = '#f59e0b'
        ctx.font = 'bold 10px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${wpIndex + 1}`, x, padding.top - 2)
      })
    }

    // Draw hover point if exists
    if (hoveredData && hoveredData.index >= 0 && hoveredData.index < profile.length) {
      const point = profile[hoveredData.index]
      const x = toX(point.distance)
      const y = toY(point.elevation)

      // Solid vertical bar
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, height - padding.bottom)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Point circle
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [profile, height, color, hoveredData, waypoints, route])

  // Handle mouse interaction
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || !profile || profile.length < 2) return

    const rect = containerRef.current.getBoundingClientRect()
    const padding = { left: 40, right: 10 }
    // Use actual displayed width from bounding rect, not stored dimensions
    const chartWidth = rect.width - padding.left - padding.right

    const mouseX = e.clientX - rect.left - padding.left
    const percentage = mouseX / chartWidth

    if (percentage < 0 || percentage > 1) {
      setHoveredData(null)
      onHoverPoint?.(null)
      return
    }

    const maxDistance = profile[profile.length - 1].distance
    const targetDistance = percentage * maxDistance

    // Find closest point
    let closestIndex = 0
    let closestDiff = Math.abs(profile[0].distance - targetDistance)

    for (let i = 1; i < profile.length; i++) {
      const diff = Math.abs(profile[i].distance - targetDistance)
      if (diff < closestDiff) {
        closestDiff = diff
        closestIndex = i
      }
    }

    const point = profile[closestIndex]
    setHoveredData({ index: closestIndex, point })

    onHoverPoint?.({
      lat: point.lat,
      lng: point.lng,
      elevation: point.elevation,
      distance: point.distance,
    })
  }, [profile, onHoverPoint])

  const handleMouseLeave = useCallback(() => {
    setHoveredData(null)
    onHoverPoint?.(null)
  }, [onHoverPoint])

  // Loading state
  if (loading) {
    return (
      <div
        className="flex items-center justify-center text-slate-400"
        style={{ height }}
      >
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading elevation...</span>
      </div>
    )
  }

  // Error state
  if (error || !profile) {
    return (
      <div
        className="flex items-center justify-center text-slate-500 text-sm"
        style={{ height }}
      >
        {error || 'Elevation data unavailable'}
      </div>
    )
  }

  const stats = calculateElevationStats(profile)

  return (
    <div className="space-y-2">
      {/* Canvas chart */}
      <div
        ref={containerRef}
        className="relative cursor-crosshair w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          data-testid="elevation-canvas"
          className="block"
          style={{ width: '100%', height }}
        />

        {/* Tooltip */}
        {hoveredData && (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 shadow-lg pointer-events-none z-10"
          >
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400">Distance: </span>
                <span className="text-white font-medium">
                  {(hoveredData.point.distance / 1000).toFixed(2)} km
                </span>
              </div>
              <div>
                <span className="text-slate-400">Elevation: </span>
                <span className="text-white font-medium">
                  {Math.round(hoveredData.point.elevation)} m
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact stats row */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="text-green-400">↑</span>
            <span className="text-slate-300 font-medium">{stats.gain}m</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-red-400">↓</span>
            <span className="text-slate-300 font-medium">{stats.loss}m</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Min: {stats.min}m</span>
          <span>•</span>
          <span>Max: {stats.max}m</span>
        </div>
      </div>
    </div>
  )
}

export default ElevationProfile
