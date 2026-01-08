import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchElevationProfile, calculateElevationStats } from '../services/elevation'

/**
 * Modern elevation profile component using Canvas for smooth rendering
 * Clean, minimal design that fits the new MapLibre layout
 */
function ElevationProfile({ route, color = '#3b82f6', onHoverPoint, height = 120 }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hoveredData, setHoveredData] = useState(null)
  const [dimensions, setDimensions] = useState({ width: 0, height })

  // Fetch elevation data
  useEffect(() => {
    const loadElevation = async () => {
      if (!route?.geometry?.coordinates) {
        setLoading(false)
        setError('No route data')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const data = await fetchElevationProfile(route.geometry.coordinates)
        const validData = data.filter(p => p.elevation !== null)
        
        if (validData.length < 2) {
          setError('Insufficient elevation data')
          setProfile(null)
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
  }, [route])

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height,
        })
      }
    })

    observer.observe(container)
    // Initial size
    setDimensions({ width: container.clientWidth, height })

    return () => observer.disconnect()
  }, [height])

  // Draw the elevation profile on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !profile || profile.length < 2 || dimensions.width === 0) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const { width, height } = dimensions

    // Set canvas size with DPR for crisp rendering
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

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

    // X-axis labels (distance)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const distKm = maxDistance / 1000
    const distSteps = Math.min(5, Math.ceil(distKm))
    for (let i = 0; i <= distSteps; i++) {
      const dist = (maxDistance / distSteps) * i
      const x = toX(dist)
      ctx.fillText(`${(dist / 1000).toFixed(1)}`, x, height - padding.bottom + 5)
    }

    // Draw "km" label at end
    ctx.textAlign = 'left'
    ctx.fillText('km', width - padding.right + 5, height - padding.bottom + 5)

    // Draw hover point if exists
    if (hoveredData && hoveredData.index >= 0 && hoveredData.index < profile.length) {
      const point = profile[hoveredData.index]
      const x = toX(point.distance)
      const y = toY(point.elevation)

      // Vertical line
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, height - padding.bottom)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // Point circle
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [profile, dimensions, color, hoveredData])

  // Handle mouse interaction
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || !profile || profile.length < 2) return

    const rect = containerRef.current.getBoundingClientRect()
    const padding = { left: 40, right: 10 }
    const chartWidth = dimensions.width - padding.left - padding.right
    
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
  }, [profile, dimensions, onHoverPoint])

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
        className="relative cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ height }}
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
