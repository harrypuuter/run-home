import Button from '../ui/Button'
import Slider from '../ui/Slider'

const QUICK_DISTANCES = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 21, label: '21 km', subtitle: 'Half Marathon' },
  { value: 42, label: '42 km', subtitle: 'Marathon' },
  { value: 100, label: '100 km' },
]

function DistanceSelect({ distance, onUpdate, onNext, onBack }) {
  const canProceed = distance >= 2 && distance <= 150

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Slider */}
      <Slider
        value={distance}
        onChange={onUpdate}
        min={2}
        max={150}
        step={1}
        label="Distance"
        unit="km"
      />

      {/* Quick select buttons */}
      <div>
        <p className="text-sm font-medium text-slate-400 mb-3">Quick Select</p>
        <div className="flex flex-wrap gap-2 md:gap-3">
          {QUICK_DISTANCES.map(({ value, label, subtitle }) => (
            <button
              key={value}
              onClick={() => onUpdate(value)}
              className={`
                px-4 py-2 md:px-5 md:py-3 rounded-full font-medium text-sm md:text-base
                transition-all duration-200
                ${distance === value
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-700/50 backdrop-blur border border-slate-600/50 text-slate-300 hover:bg-slate-700/70'
                }
              `}
            >
              {label}
              {subtitle && (
                <span className="block text-xs opacity-75">{subtitle}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Info text */}
      <p className="text-sm md:text-base text-slate-400 text-center">
        We'll find transit stops approximately <span className="font-semibold text-white">{distance} km</span> from your home
      </p>

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

export default DistanceSelect
