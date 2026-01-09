import { getProductIcon } from '../../services/deutschebahn'
import { formatTime } from '../../services/deutschebahn'

export default function TransitJourneyDetails({ journey }) {
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
