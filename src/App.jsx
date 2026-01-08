import { useState, useEffect } from 'react'
import Wizard from './components/Wizard'
import { checkApiAvailability } from './services/deutschebahn'

function App() {
  // Track DB API availability
  const [dbApiAvailable, setDbApiAvailable] = useState(null) // null = checking, true/false = result

  // Get default departure time (now + 15 min, rounded to 5 min)
  const getDefaultDepartureTime = () => {
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5 + 15)
    now.setSeconds(0)
    now.setMilliseconds(0)
    return now
  }

  const [wizardState, setWizardState] = useState({
    currentStep: 1,

    // Step 1: Home Location
    homeLocation: null, // { lat, lng, displayName }

    // Step 2: Distance
    distance: 10, // km (default)

    // Step 3: Activity
    activity: 'run', // 'run' | 'bike'

    // Step 4: Departure Time (replaces Transit Types)
    departureTime: getDefaultDepartureTime(),

    // Step 5: Direction
    direction: null, // 'north' | 'east' | 'south' | 'west' | 'any'

    // Step 6: Results
    transitStops: [],
    routes: [],
    routeCache: {},
    isLoading: false,
    error: null,
  })

  // Check DB API availability on startup
  useEffect(() => {
    const checkApi = async () => {
      console.log('[App] Checking DB API availability in background...')
      try {
        const isAvailable = await checkApiAvailability()
        setDbApiAvailable(isAvailable)
        console.log('[App] DB API available:', isAvailable)
      } catch (error) {
        console.error('[App] DB API check failed:', error)
        setDbApiAvailable(false)
      }
    }
    checkApi()
  }, [])

  // Load saved home location from localStorage
  useEffect(() => {
    const savedHome = localStorage.getItem('runhome_homeLocation')
    if (savedHome) {
      try {
        const parsed = JSON.parse(savedHome)
        setWizardState(prev => ({
          ...prev,
          homeLocation: parsed
        }))
      } catch (e) {
        console.error('Failed to parse saved home location:', e)
      }
    }
  }, [])

  // Save home location to localStorage when it changes
  useEffect(() => {
    if (wizardState.homeLocation) {
      localStorage.setItem('runhome_homeLocation', JSON.stringify(wizardState.homeLocation))
    }
  }, [wizardState.homeLocation])

  const updateState = (updates) => {
    setWizardState(prev => ({ ...prev, ...updates }))
  }

  const goToStep = (step) => {
    setWizardState(prev => ({ ...prev, currentStep: step }))
  }

  const nextStep = () => {
    setWizardState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }))
  }

  const prevStep = () => {
    setWizardState(prev => ({ ...prev, currentStep: Math.max(1, prev.currentStep - 1) }))
  }

  const resetWizard = () => {
    setWizardState(prev => ({
      ...prev,
      currentStep: 1,
      direction: null,
      transitStops: [],
      routes: [],
      routeCache: {},
      isLoading: false,
      error: null,
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Wizard
        state={wizardState}
        updateState={updateState}
        goToStep={goToStep}
        nextStep={nextStep}
        prevStep={prevStep}
        resetWizard={resetWizard}
        dbApiAvailable={dbApiAvailable}
      />
    </div>
  )
}

export default App
