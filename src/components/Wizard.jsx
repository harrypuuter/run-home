import ProgressBar from './ProgressBar'
import HomeLocation from './steps/HomeLocation'
import DistanceSelect from './steps/DistanceSelect'
import ActivitySelect from './steps/ActivitySelect'
import DepartureTime from './steps/DepartureTime'
import DirectionSelect from './steps/DirectionSelect'
import RouteResults from './steps/RouteResults'

const TOTAL_STEPS = 6

const STEP_TITLES = {
  1: 'Set Your Home Location',
  2: 'Choose Distance',
  3: 'Choose Activity',
  4: 'When do you want to travel?',
  5: 'Choose Direction',
  6: 'Your Routes',
}

function Wizard({ state, updateState, goToStep, nextStep, prevStep, resetWizard, dbApiAvailable }) {
  const { currentStep } = state

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <HomeLocation
            homeLocation={state.homeLocation}
            onUpdate={(homeLocation) => updateState({ homeLocation })}
            onNext={nextStep}
          />
        )
      case 2:
        return (
          <DistanceSelect
            distance={state.distance}
            onUpdate={(distance) => updateState({ distance })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 3:
        return (
          <ActivitySelect
            activity={state.activity}
            onUpdate={(activity) => updateState({ activity })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 4:
        return (
          <DepartureTime
            departureTime={state.departureTime}
            onUpdate={(departureTime) => updateState({ departureTime })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 5:
        return (
          <DirectionSelect
            direction={state.direction}
            onUpdate={(direction) => updateState({ direction })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 6:
        return (
          <RouteResults
            state={state}
            updateState={updateState}
            onReset={resetWizard}
            dbApiAvailable={dbApiAvailable}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl">
        {/* Progress bar */}
        <div className="mb-6 md:mb-8">
          <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>

        {/* Main card */}
        <div className="glass-card-elevated p-6 md:p-8 lg:p-10">
          {/* Step title */}
          <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold text-white mb-6 md:mb-8">
            {STEP_TITLES[currentStep]}
          </h1>

          {/* Step content */}
          {renderStep()}
        </div>
      </div>
    </div>
  )
}

export default Wizard
