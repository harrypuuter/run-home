import { useState, useEffect, useRef } from 'react'
import { MapPin, Home, Flag, Trash2, Plus, AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * RouteEditor - Simplified waypoint editor integrated into route detail panel
 *
 * Features:
 * - Click on map to add waypoints (no drag-to-edit route)
 * - Click waypoint to highlight on map
 * - Manual "Update Route" button to recalculate
 */
export default function RouteEditor({
  editMode,
  waypoints = [],
  waypointDistances = [],
  startPoint = null,
  endPoint = null,
  selectedWaypointIndex = null,
  waypointError = null,
  routeNeedsUpdate = false,
  onRemoveWaypoint,
  onSelectWaypoint,
  onUpdateRoute,
}) {
  // Track button highlight effect when waypoints change
  const [isHighlighted, setIsHighlighted] = useState(false)
  const prevNeedsUpdate = useRef(routeNeedsUpdate)

  // Pulse the button when routeNeedsUpdate changes from false to true
  useEffect(() => {
    if (routeNeedsUpdate && !prevNeedsUpdate.current) {
      setIsHighlighted(true)
      const timeout = setTimeout(() => setIsHighlighted(false), 600)
      return () => clearTimeout(timeout)
    }
    prevNeedsUpdate.current = routeNeedsUpdate
  }, [routeNeedsUpdate])

  if (!editMode) return null

  return (
    <div className="space-y-3">
      {/* Update Route button at top */}
      {waypoints.length > 0 && (
        <button
          onClick={() => onUpdateRoute?.()}
          className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            routeNeedsUpdate
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 border border-slate-600/50'
          } ${isHighlighted ? 'animate-pulse ring-2 ring-blue-400/50' : ''}`}
        >
          <RefreshCw className="w-4 h-4" />
          {routeNeedsUpdate ? 'Update Route' : 'Route up to date'}
        </button>
      )}

      {/* Error message */}
      {waypointError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 rounded-lg border border-red-500/50 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{waypointError}</span>
        </div>
      )}

      {/* Waypoints list */}
      <div className="space-y-1.5">
        {/* Start point */}
        {startPoint && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 rounded-lg border border-green-700/30">
            <Flag className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-green-300 truncate">{startPoint.name || 'Start'}</div>
            </div>
          </div>
        )}

        {/* Waypoints */}
        {waypoints.map((wp, i) => {
          const distFromPrev = waypointDistances[i]
          const distLabel = distFromPrev >= 1000
            ? `${(distFromPrev / 1000).toFixed(1)} km from ${i === 0 ? 'start' : `#${i}`}`
            : `${Math.round(distFromPrev)} m from ${i === 0 ? 'start' : `#${i}`}`
          return (
            <div
              key={`wp-${i}`}
              onClick={() => onSelectWaypoint?.(i)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
                ${selectedWaypointIndex === i
                  ? 'bg-amber-500/20 border-amber-500/50'
                  : 'bg-slate-700/30 border-slate-600/30 hover:border-slate-500/50'
                }
              `}
            >
              <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200">Waypoint {i + 1}</div>
                <div className="text-xs text-slate-500">{distLabel}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveWaypoint?.(i) }}
                className="p-1.5 rounded-lg hover:bg-red-600/30 text-slate-400 hover:text-red-400 transition-colors"
                aria-label={`Remove waypoint ${i + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        })}

        {/* Empty state */}
        {waypoints.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-4 bg-slate-700/20 rounded-lg border border-dashed border-slate-600/50">
            <Plus className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-500">Tap on the map to add waypoints</span>
          </div>
        )}

        {/* End point */}
        {endPoint && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 rounded-lg border border-blue-700/30">
            <Home className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-blue-300 truncate">{endPoint.name || 'Home'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
