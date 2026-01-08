function Slider({ value, onChange, min = 0, max = 100, step = 1, label, unit = '' }) {
  return (
    <div className="space-y-3">
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">{label}</span>
          <span className="text-lg font-semibold text-white">
            {value} {unit}
          </span>
        </div>
      )}

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-700/50 rounded-full appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-5
                   [&::-webkit-slider-thumb]:h-5
                   [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-gradient-to-r
                   [&::-webkit-slider-thumb]:from-blue-500
                   [&::-webkit-slider-thumb]:to-indigo-500
                   [&::-webkit-slider-thumb]:shadow-lg
                   [&::-webkit-slider-thumb]:shadow-blue-500/25
                   [&::-webkit-slider-thumb]:cursor-pointer
                   [&::-webkit-slider-thumb]:transition-all
                   [&::-webkit-slider-thumb]:hover:scale-110"
      />

      <div className="flex justify-between text-xs text-slate-500">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  )
}

export default Slider
