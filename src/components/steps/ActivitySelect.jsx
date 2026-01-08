import Button from '../ui/Button'
import RadioCard from '../ui/RadioCard'

function ActivitySelect({ activity, onUpdate, onNext, onBack }) {
  const canProceed = ['run', 'bike'].includes(activity)

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Activity cards */}
      <div className="grid grid-cols-2 gap-4 md:gap-6">
        <RadioCard
          selected={activity === 'run'}
          onClick={() => onUpdate('run')}
          icon="🏃‍♂️"
          label="Run"
          color="green"
        />
        <RadioCard
          selected={activity === 'bike'}
          onClick={() => onUpdate('bike')}
          icon="🚴"
          label="Bike"
          color="orange"
        />
      </div>

      {/* Info text */}
      <div className="text-center">
        {activity === 'run' && (
          <p className="text-sm md:text-base text-slate-400">
            Running route • ~6 min/km average pace
          </p>
        )}
        {activity === 'bike' && (
          <p className="text-sm md:text-base text-slate-400">
            Cycling route • ~3 min/km average pace
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
          Continue
        </Button>
      </div>
    </div>
  )
}

export default ActivitySelect
