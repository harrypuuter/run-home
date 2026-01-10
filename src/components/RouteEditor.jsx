import { useState, useEffect } from 'react'

export default function RouteEditor({ editMode, waypoints = [], onToggleEdit, onAddWaypoint, onRemoveWaypoint, onSave, onCancel }) {
  const [localWaypoints, setLocalWaypoints] = useState(waypoints)

  useEffect(() => setLocalWaypoints(waypoints), [waypoints])

  const handleRemove = (idx) => {
    const nw = [...localWaypoints]
    nw.splice(idx, 1)
    setLocalWaypoints(nw)
    onRemoveWaypoint?.(idx)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-300">✏️ Route Editor</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleEdit}
            className={`px-2 py-1 rounded-md text-sm font-medium transition-colors ${editMode ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-200'}`}
            aria-pressed={editMode}
            aria-label={editMode ? 'Exit edit mode' : 'Enter edit mode'}
          >
            {editMode ? 'Exit' : 'Edit'}
          </button>
        </div>
      </div>

      {editMode && (
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 space-y-2">
          <p className="text-xs text-slate-400">Click on the map to add a waypoint. Drag markers to reposition them. Click a waypoint to remove it.</p>

          <div className="space-y-1">
            {localWaypoints.map((wp, i) => (
              <div key={`wp-${i}`} className="flex items-center justify-between text-sm text-slate-300">
                <div>Waypoint {i + 1}: {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleRemove(i)} className="px-2 py-0.5 rounded bg-red-600 text-white text-xs">Remove</button>
                </div>
              </div>
            ))}
            {localWaypoints.length === 0 && <div className="text-xs text-slate-500">No waypoints yet</div>}
          </div>

          <div className="flex gap-2">
            <button onClick={() => onSave?.(localWaypoints)} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm">Save</button>
            <button onClick={() => onCancel?.()} className="flex-1 py-2 rounded-lg bg-slate-700 text-white text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
