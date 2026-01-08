import Button from '../ui/Button'
import CompassSelector from '../ui/CompassSelector'

const DIRECTION_DESCRIPTIONS = {
  north: 'Transit stops to the north of your home',
  east: 'Transit stops to the east of your home',
  south: 'Transit stops to the south of your home',
  west: 'Transit stops to the west of your home',
  any: 'Transit stops in any direction',
}

function DirectionSelect({ direction, onUpdate, onNext, onBack }) {
  const canProceed = ['north', 'east', 'south', 'west', 'any'].includes(direction)

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Compass selector */}
      <CompassSelector
        selected={direction}
        onSelect={onUpdate}
      />

      {/* Description */}
      <div className="text-center min-h-[48px]">
        {direction && (
          <p className="text-sm md:text-base text-slate-400">
            {DIRECTION_DESCRIPTIONS[direction]}
          </p>
        )}
        {!direction && (
          <p className="text-sm md:text-base text-slate-500">
            Select a direction or "Any" for all directions
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4 md:pt-6">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1"
        >
          Find Routes
        </Button>
      </div>
    </div>
  )
}

export default DirectionSelect
