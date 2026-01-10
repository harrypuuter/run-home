import { X, Download, Route, Clock, Flame, Flag, Pencil, Check } from 'lucide-react'
import ElevationProfile from '../ElevationProfile'
import TransitJourneyDetails from './TransitJourneyDetails'
import RouteEditor from '../RouteEditor'
import { getStopIcon, formatTime } from '../../services/deutschebahn'

// Helpers
function calculateCalories(distanceKm, elevationGain = 0, activity = 'run') {
  const baseCalPerKm = activity === 'run' ? 60 : 35
  const terrainFactor = 1 + (elevationGain / 100) * 0.1
  return Math.round(distanceKm * baseCalPerKm * terrainFactor)
}

function formatPace(paceMinPerKm) {
  const mins = Math.floor(paceMinPerKm)
  const secs = Math.round((paceMinPerKm - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function calculateDuration(distanceKm, paceMinPerKm) {
  const totalMinutes = distanceKm * paceMinPerKm
  const hours = Math.floor(totalMinutes / 60)
  const mins = Math.round(totalMinutes % 60)
  return hours > 0 ? `${hours}h ${mins}m` : `${mins} min`
}

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

export default function RouteDetailPanel({
  item,
  onClose,
  onHoverPoint,
  onDownloadGPX,
  activity,
  pace,
  onPaceChange,
  showTransitOnMap = false,
  onToggleShowTransit,
  dbApiAvailable = false,
  homeLocation = null,
  // Editor props
  editMode = false,
  waypoints = [],
  selectedWaypointIndex = null,
  waypointError = null,
  routeNeedsUpdate = false,
  onToggleEdit,
  onRemoveWaypoint,
  onSelectWaypoint,
  onUpdateRoute,
  onSave,
  onCancel,
}) {
  if (!item || !item.route) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        Route details unavailable
      </div>
    )
  }

  const distanceKm = item.route.distance / 1000
  const duration = calculateDuration(distanceKm, pace)
  const calories = calculateCalories(distanceKm, 0, activity)
  const departureTime = item.transitJourney?.legs?.[0]?.origin?.departure
  const runDurationMs = distanceKm * pace * 60 * 1000

  let eta = null
  if (departureTime) {
    const depDate = new Date(departureTime)
    const transitDuration = item.transitJourney?.duration || 0
    eta = new Date(depDate.getTime() + transitDuration + runDurationMs)
  } else {
    eta = new Date(Date.now() + runDurationMs)
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <button
          onClick={editMode ? onCancel : onClose}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          aria-label={editMode ? 'Cancel editing' : 'Close route details'}
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-white">
          {editMode ? 'Edit Route' : 'Route Details'}
        </h2>
        <div className="flex items-center gap-2">
          {!editMode && dbApiAvailable && (
            <button
              onClick={onToggleShowTransit}
              className={`px-2 py-1 rounded-md text-sm font-medium transition-colors ${
                showTransitOnMap 
                  ? 'bg-slate-700 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700/50'
              }`}
              aria-pressed={showTransitOnMap}
            >
              {showTransitOnMap ? 'Transit on map' : 'Show transit'}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stop info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{getStopIcon(item.stop.type)}</span>
            <h3 className="text-lg font-semibold text-white">{item.stop.name}</h3>
          </div>
          {!item.noTransitInfo && item.transitJourney?.legs && (
            <p className="text-sm text-slate-400">
              {item.transitJourney.legs.filter(l => l.line).map(l => l.line.name).join(' → ')}
              {departureTime && ` • Depart ${formatTime(departureTime)}`}
            </p>
          )}
        </div>

        {/* Pace control */}
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">⚙️ Your Pace</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPaceChange(Math.max(2, pace - 0.5))}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
              >-</button>
              <span className="text-white font-mono text-sm w-12 text-center">{formatPace(pace)}</span>
              <button
                onClick={() => onPaceChange(Math.min(10, pace + 0.5))}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
              >+</button>
              <span className="text-xs text-slate-500">min/km</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatBox icon={<Route className="w-4 h-4" />} label="Distance" value={`${distanceKm.toFixed(1)} km`} />
          <StatBox icon={<Clock className="w-4 h-4" />} label="Duration" value={duration} />
          <StatBox icon={<Flame className="w-4 h-4" />} label="Calories" value={`~${calories} kcal`} />
          <StatBox icon={<Flag className="w-4 h-4" />} label="ETA" value={eta?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) || '--:--'} />
        </div>

        {/* Elevation profile */}
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <h4 className="text-sm font-medium text-slate-300 mb-2">📈 Elevation Profile</h4>
          <ElevationProfile key={`elevation-${item.stop.id}-${item.route?.distance || 0}`} route={item.route} color={item.color} onHoverPoint={onHoverPoint} height={180} />
        </div>

        {/* Transit details (only in view mode) */}
        {!editMode && !item.noTransitInfo && item.transitJourney && (
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-300 mb-2">🚇 Getting There</h4>
            <TransitJourneyDetails journey={item.transitJourney} />
          </div>
        )}

        {/* Edit mode: Waypoint editor */}
        {editMode && (
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-300 mb-3">📍 Waypoints</h4>
            <RouteEditor
              editMode={editMode}
              waypoints={waypoints}
              startPoint={item?.stop ? { lat: item.stop.lat, lng: item.stop.lng, name: item.stop.name } : null}
              endPoint={homeLocation ? { lat: homeLocation.lat, lng: homeLocation.lng, name: 'Home' } : null}
              selectedWaypointIndex={selectedWaypointIndex}
              waypointError={waypointError}
              routeNeedsUpdate={routeNeedsUpdate}
              onRemoveWaypoint={onRemoveWaypoint}
              onSelectWaypoint={onSelectWaypoint}
              onUpdateRoute={onUpdateRoute}
            />
          </div>
        )}
      </div>

      {/* Footer - changes based on edit mode */}
      <div className="p-4 border-t border-slate-700/50 space-y-2">
        {editMode ? (
          /* Edit mode: Save and Cancel buttons */
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-green-500/20"
            >
              <Check className="w-5 h-5" />
              Save Changes
            </button>
            <button
              onClick={onCancel}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
              Discard
            </button>
          </div>
        ) : (
          /* View mode: Download and Edit buttons */
          <div className="flex gap-2">
            <button
              onClick={(e) => onDownloadGPX(e, item)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-green-500/20"
            >
              <Download className="w-5 h-5" />
              Download GPX
            </button>
            <button
              onClick={onToggleEdit}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
            >
              <Pencil className="w-5 h-5" />
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
