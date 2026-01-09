import { useState, useCallback } from 'react'
import RouteResults from '../components/steps/RouteResults'
import { Bug, RefreshCw, Settings, Map, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Debug page for testing MapLibre and RouteResults without going through the wizard.
 * Access at: /run-home/debug
 *
 * Pre-configured test locations:
 * - Berlin Alexanderplatz area
 * - Munich Marienplatz area
 * - Hamburg Hauptbahnhof area
 */

const TEST_LOCATIONS = {
  berlin: {
    name: 'Berlin (Alexanderplatz)',
    homeLocation: {
      lat: 52.5200,
      lng: 13.4050,
      displayName: 'Alexanderplatz, Berlin, Germany',
    },
  },
  munich: {
    name: 'Munich (Marienplatz)',
    homeLocation: {
      lat: 48.1351,
      lng: 11.5820,
      displayName: 'Marienplatz, Munich, Germany',
    },
  },
  hamburg: {
    name: 'Hamburg (Hauptbahnhof)',
    homeLocation: {
      lat: 53.5511,
      lng: 9.9937,
      displayName: 'Hamburg Hauptbahnhof, Germany',
    },
  },
  frankfurt: {
    name: 'Frankfurt (Hauptwache)',
    homeLocation: {
      lat: 50.1109,
      lng: 8.6821,
      displayName: 'Hauptwache, Frankfurt, Germany',
    },
  },
}

const DEFAULT_STATE = {
  location: 'berlin',
  distance: 8, // km
  activity: 'run',
  direction: 'any',
}

function DebugMapLibre() {
  const [showSettings, setShowSettings] = useState(true)
  const [debugConfig, setDebugConfig] = useState(DEFAULT_STATE)
  const [isRunning, setIsRunning] = useState(false)
  const [runKey, setRunKey] = useState(0)

  // Build the state that RouteResults expects
  const buildState = useCallback(() => {
    const location = TEST_LOCATIONS[debugConfig.location]
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5 + 15)

    return {
      homeLocation: location.homeLocation,
      distance: debugConfig.distance,
      activity: debugConfig.activity,
      departureTime: now,
      direction: debugConfig.direction,
      transitStops: [],
      isLoading: false,
      error: null,
    }
  }, [debugConfig])

  const [state, setState] = useState(buildState)

  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const handleReset = useCallback(() => {
    setIsRunning(false)
    setRunKey(prev => prev + 1)
  }, [])

  const handleStart = () => {
    setState(buildState())
    setRunKey(prev => prev + 1)
    setIsRunning(true)
    setShowSettings(false)
  }

  const handleConfigChange = (key, value) => {
    setDebugConfig(prev => ({ ...prev, [key]: value }))
  }

  // If running, show RouteResults directly
  if (isRunning) {
    return (
      <div className="relative">
        {/* Debug overlay button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-colors"
          title="Toggle Debug Settings"
        >
          <Bug className="w-5 h-5" />
        </button>

        {/* Debug settings overlay */}
        {showSettings && (
          <div className="fixed top-14 left-4 z-50 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-white font-semibold">
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Debug Controls
              </span>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <p><strong>Location:</strong> {TEST_LOCATIONS[debugConfig.location].name}</p>
              <p><strong>Distance:</strong> {debugConfig.distance} km</p>
              <p><strong>Activity:</strong> {debugConfig.activity}</p>
              <p><strong>Direction:</strong> {debugConfig.direction}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Restart
              </button>
              <a
                href="/run-home/"
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
              >
                Exit Debug
              </a>
            </div>
          </div>
        )}

        <RouteResults
          key={runKey}
          state={state}
          updateState={updateState}
          onReset={handleReset}
          dbApiAvailable={false} // Use OSM fallback for reliability in testing
        />
      </div>
    )
  }

  // Show configuration panel before starting
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-2">
            <Bug className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">MapLibre Debug Mode</h1>
          <p className="text-slate-400 text-sm">
            Skip the wizard and test RouteResults directly with pre-configured values
          </p>
        </div>

        {/* Location Select */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Test Location</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TEST_LOCATIONS).map(([key, loc]) => (
              <button
                key={key}
                onClick={() => handleConfigChange('location', key)}
                className={`p-3 rounded-xl border text-sm text-left transition-all ${
                  debugConfig.location === key
                    ? 'bg-purple-600/20 border-purple-500 text-white'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <Map className="w-4 h-4 mb-1 opacity-60" />
                {loc.name.split(' (')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Distance Slider */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Distance: <span className="text-purple-400">{debugConfig.distance} km</span>
          </label>
          <input
            type="range"
            min="3"
            max="25"
            step="1"
            value={debugConfig.distance}
            onChange={(e) => handleConfigChange('distance', parseInt(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>3 km</span>
            <span>25 km</span>
          </div>
        </div>

        {/* Activity Toggle */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Activity</label>
          <div className="flex gap-2">
            {[
              { key: 'run', label: '🏃 Run', icon: '🏃' },
              { key: 'bike', label: '🚴 Bike', icon: '🚴' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleConfigChange('activity', key)}
                className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                  debugConfig.activity === key
                    ? 'bg-purple-600/20 border-purple-500 text-white'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Direction Select */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Direction</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'any', label: 'Any' },
              { key: 'north', label: '↑ N' },
              { key: 'east', label: '→ E' },
              { key: 'south', label: '↓ S' },
              { key: 'west', label: '← W' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleConfigChange('direction', key)}
                className={`py-2 px-3 rounded-lg border text-sm transition-all ${
                  debugConfig.direction === key
                    ? 'bg-purple-600/20 border-purple-500 text-white'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Options (collapsible) */}
        <details className="group">
          <summary className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-slate-300">
            <ChevronDown className="w-4 h-4 group-open:hidden" />
            <ChevronUp className="w-4 h-4 hidden group-open:block" />
            Advanced Options
          </summary>
          <div className="mt-3 p-3 bg-slate-700/30 rounded-lg space-y-2 text-xs text-slate-400">
            <p><strong>DB API:</strong> Disabled (using OSM fallback)</p>
            <p><strong>Departure:</strong> Auto (now + 15 min)</p>
            <p>These settings are optimized for reliable debug testing.</p>
          </div>
        </details>

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500
                     text-white font-semibold text-lg shadow-lg shadow-purple-500/25
                     hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5
                     active:translate-y-0 transition-all duration-200"
        >
          Start Debug Session
        </button>

        {/* Footer link */}
        <div className="text-center">
          <a
            href="/run-home/"
            className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
          >
            ← Back to normal app
          </a>
        </div>
      </div>
    </div>
  )
}

export default DebugMapLibre
