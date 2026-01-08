function ProgressBar({ currentStep, totalSteps }) {
  const progress = (currentStep / totalSteps) * 100

  return (
    <div className="space-y-2">
      {/* Step indicator */}
      <div className="flex justify-between text-sm text-slate-400">
        <span>Step {currentStep} of {totalSteps}</span>
        <span>{Math.round(progress)}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden backdrop-blur">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step dots */}
      <div className="flex justify-between px-1 pt-1">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              step <= currentStep
                ? 'bg-blue-500'
                : 'bg-slate-600'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default ProgressBar
