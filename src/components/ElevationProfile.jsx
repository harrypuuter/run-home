import { useState, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, TrendingDown, Mountain, Loader2 } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { fetchElevationProfile, calculateElevationStats } from '../services/elevation'

function ElevationProfile({ route, color = '#3b82f6', onHoverPoint }) {
  const [profile, setProfile] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const chartRef = useRef(null)
  const validPointsRef = useRef([])

  useEffect(() => {
    const loadElevation = async () => {
      if (!route?.geometry?.coordinates) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const elevationData = await fetchElevationProfile(route.geometry.coordinates)
        setProfile(elevationData)
        setStats(calculateElevationStats(elevationData))
      } catch (err) {
        console.error('Failed to load elevation:', err)
        setError('Could not load elevation data')
      } finally {
        setLoading(false)
      }
    }

    loadElevation()
  }, [route])

  // Handle mouse move on chart container
  const handleChartMouseMove = useCallback((e) => {
    if (!chartRef.current || validPointsRef.current.length === 0) return

    // Get chart dimensions and mouse position relative to chart
    const rect = chartRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width

    if (percentage < 0 || percentage > 1) {
      setHoveredIndex(null)
      if (onHoverPoint) {
        onHoverPoint(null)
      }
      return
    }

    // Find closest data point based on mouse position
    const index = Math.round(percentage * (validPointsRef.current.length - 1))
    const clampedIndex = Math.max(0, Math.min(index, validPointsRef.current.length - 1))

    if (clampedIndex >= 0 && clampedIndex < validPointsRef.current.length && clampedIndex !== hoveredIndex) {
      setHoveredIndex(clampedIndex)
      const point = validPointsRef.current[clampedIndex]
      if (onHoverPoint && typeof point.lat === 'number' && typeof point.lng === 'number') {
        onHoverPoint({
          lat: point.lat,
          lng: point.lng,
          elevation: point.elevation,
          distance: point.distance,
        })
      }
    }
  }, [hoveredIndex, onHoverPoint])

  const handleChartMouseLeave = useCallback(() => {
    setHoveredIndex(null)
    if (onHoverPoint) {
      onHoverPoint(null)
    }
  }, [onHoverPoint])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading elevation...</span>
      </div>
    )
  }

  const validPoints = profile.filter(p => p.elevation !== null)

  // Update ref so handlers can access latest valid points
  validPointsRef.current = validPoints

  if (error || !profile.length) {
    return (
      <div className="text-center py-4 text-slate-500 text-sm">
        {error || 'Elevation data unavailable'}
      </div>
    )
  }

  if (validPoints.length < 2) {
    return null
  }

  // Format data for Recharts
  const chartData = validPoints.map(p => ({
    ...p,
    distanceKm: p.distance / 1000,
    elevationRounded: Math.round(p.elevation),
  }))

  const minElev = Math.min(...validPoints.map(p => p.elevation))
  const maxElev = Math.max(...validPoints.map(p => p.elevation))

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs text-slate-400">Distance</p>
          <p className="text-sm font-semibold text-white">{data.distanceKm.toFixed(2)} km</p>
          <p className="text-xs text-slate-400 mt-1">Elevation</p>
          <p className="text-sm font-semibold text-white">{data.elevationRounded} m</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-3">
      {/* Elevation chart */}
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <Mountain className="w-3 h-3" />
            Elevation Profile
          </span>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{Math.round(minElev)}m</span>
            <span>-</span>
            <span>{Math.round(maxElev)}m</span>
          </div>
        </div>

        <div
          ref={chartRef}
          className="h-32 w-full"
          onMouseMove={handleChartMouseMove}
          onMouseLeave={handleChartMouseLeave}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="distanceKm"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => `${value.toFixed(1)}`}
                interval="preserveStartEnd"
              />

              <YAxis
                domain={[minElev - 10, maxElev + 10]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => `${Math.round(value)}`}
                width={35}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: '#94a3b8',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />

              <Area
                type="monotone"
                dataKey="elevation"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${color.replace('#', '')})`}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: color,
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
          <span>0 km</span>
          <span>{(chartData[chartData.length - 1]?.distanceKm || 0).toFixed(1)} km</span>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800/30 rounded-lg p-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <div>
              <p className="text-xs text-slate-500">Elevation Gain</p>
              <p className="text-sm font-medium text-slate-200">{stats.gain} m</p>
            </div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-2 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <div>
              <p className="text-xs text-slate-500">Elevation Loss</p>
              <p className="text-sm font-medium text-slate-200">{stats.loss} m</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ElevationProfile
