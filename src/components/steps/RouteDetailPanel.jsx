import { X, Download, Route, Clock, Flame, Flag } from 'lucide-react'
import ElevationProfile from '../ElevationProfile'
import TransitJourneyDetails from './TransitJourneyDetails'
import { getStopIcon } from '../../services/deutschebahn'
import { formatTime } from '../../services/deutschebahn'

// Helpers (copied from RouteResults for now)
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
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins} min`
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

export default function RouteDetailPanel({ item, onClose, onHoverPoint, onDownloadGPX, activity, pace, onPaceChange, showTransitOnMap = false, onToggleShowTransit }) {
  const distanceKm = item.route.distance / 1000
  const duration = calculateDuration(distanceKm, pace)
  const calories = calculateCalories(distanceKm, 0, activity)

  const departureTime = item.transitJourney?.legs?.[0]?.origin?.departure
  let eta = null
  const runDurationMs = distanceKm * pace * 60 * 1000 // ms

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
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          aria-label="Close route details"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-white">Route Details</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dbApiAvailable ? onToggleShowTransit?.() : undefined}
            className={`px-2 py-1 rounded-md text-sm font-medium transition-colors ${showTransitOnMap ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700/50'} ${!dbApiAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-pressed={showTransitOnMap}
            aria-disabled={!dbApiAvailable}
            title={!dbApiAvailable ? 'Transit API unavailable' : (showTransitOnMap ? 'Hide transit on map' : 'Show transit')}
            aria-label={showTransitOnMap ? 'Hide transit on map' : 'Show transit'}
            disabled={!dbApiAvailable}
          >
            {showTransitOnMap ? 'Transit on map' : (dbApiAvailable ? 'Show transit' : 'Transit unavailable')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">⚙️ Your Pace</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPaceChange(Math.max(2, pace - 0.5))}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
                aria-label="Decrease pace"
              >
                -
              </button>
              <span className="text-white font-mono text-sm w-12 text-center">{formatPace(pace)}</span>
              <button
                onClick={() => onPaceChange(Math.min(10, pace + 0.5))}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
                aria-label="Increase pace"
              >
                +
              </button>
              <span className="text-xs text-slate-500">min/km</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatBox icon={<Route className="w-4 h-4" />} label="Distance" value={`${distanceKm.toFixed(1)} km`} />
          <StatBox icon={<Clock className="w-4 h-4" />} label="Duration" value={duration} />
          <StatBox icon={<Flame className="w-4 h-4" />} label="Calories" value={`~${calories} kcal`} />
          <StatBox icon={<Flag className="w-4 h-4" />} label="ETA" value={eta ? eta.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--'} />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <h4 className="text-sm font-medium text-slate-300 mb-2">📈 Elevation Profile</h4>
          <ElevationProfile key={`elevation-${item.stop.id}`} route={item.route} color={item.color} onHoverPoint={onHoverPoint} height={180} />
        </div>

        {!item.noTransitInfo && item.transitJourney && (
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-300 mb-2">🚇 Getting There</h4>
            <TransitJourneyDetails journey={item.transitJourney} />
          </div>
        )}

        <button disabled className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800/30 border border-slate-700/50 text-slate-500 cursor-not-allowed">
          <span>✏️</span>
          Edit Route
          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">Soon</span>
        </button>
      </div>

      <div className="p-4 border-t border-slate-700/50 space-y-2">
        <button
          onClick={(e) => onDownloadGPX(e, item)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-green-500/20"
        >
          <Download className="w-5 h-5" />
          Download GPX
        </button>
      </div>
    </div>
  )
}
