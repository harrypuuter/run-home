import { useState } from 'react'
import { Calendar, Clock } from 'lucide-react'
import Button from '../ui/Button'

function DepartureTime({ departureTime, onUpdate, onNext, onBack }) {
  // Default to now + 15 minutes, rounded to nearest 5 min
  const getDefaultTime = () => {
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5 + 15)
    now.setSeconds(0)
    now.setMilliseconds(0)
    return now
  }

  const [selectedDate, setSelectedDate] = useState(() => {
    if (departureTime) return new Date(departureTime)
    return getDefaultTime()
  })

  // Format date for date input (YYYY-MM-DD)
  const formatDateInput = (date) => {
    return date.toISOString().split('T')[0]
  }

  // Format time for time input (HH:MM)
  const formatTimeInput = (date) => {
    return date.toTimeString().slice(0, 5)
  }

  const handleDateChange = (e) => {
    const newDate = new Date(selectedDate)
    const [year, month, day] = e.target.value.split('-').map(Number)
    newDate.setFullYear(year, month - 1, day)
    setSelectedDate(newDate)
    onUpdate(newDate)
  }

  const handleTimeChange = (e) => {
    const newDate = new Date(selectedDate)
    const [hours, minutes] = e.target.value.split(':').map(Number)
    newDate.setHours(hours, minutes, 0, 0)
    setSelectedDate(newDate)
    onUpdate(newDate)
  }

  const handleQuickSelect = (option) => {
    const now = new Date()
    let newDate

    switch (option) {
      case 'now':
        newDate = new Date()
        newDate.setMinutes(Math.ceil(newDate.getMinutes() / 5) * 5)
        break
      case '30min':
        newDate = new Date(now.getTime() + 30 * 60000)
        break
      case '1hour':
        newDate = new Date(now.getTime() + 60 * 60000)
        break
      case 'tomorrow-8':
        newDate = new Date(now)
        newDate.setDate(newDate.getDate() + 1)
        newDate.setHours(8, 0, 0, 0)
        break
      case 'tomorrow-18':
        newDate = new Date(now)
        newDate.setDate(newDate.getDate() + 1)
        newDate.setHours(18, 0, 0, 0)
        break
      default:
        return
    }

    setSelectedDate(newDate)
    onUpdate(newDate)
  }

  // Get min date (today)
  const minDate = formatDateInput(new Date())

  // Get max date (14 days from now)
  const maxDate = formatDateInput(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))

  // Format display date
  const formatDisplayDate = (date) => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Description */}
      <p className="text-slate-400 text-sm md:text-base">
        Select when you want to start your journey. We'll find public transport connections
        that will take you to your starting point for running or cycling home.
      </p>

      {/* Quick select buttons */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Quick Select</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button
            onClick={() => handleQuickSelect('now')}
            className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50
                     text-slate-300 text-sm hover:bg-slate-700 hover:border-slate-500
                     transition-all duration-200"
          >
            Now
          </button>
          <button
            onClick={() => handleQuickSelect('30min')}
            className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50
                     text-slate-300 text-sm hover:bg-slate-700 hover:border-slate-500
                     transition-all duration-200"
          >
            In 30 min
          </button>
          <button
            onClick={() => handleQuickSelect('1hour')}
            className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50
                     text-slate-300 text-sm hover:bg-slate-700 hover:border-slate-500
                     transition-all duration-200"
          >
            In 1 hour
          </button>
          <button
            onClick={() => handleQuickSelect('tomorrow-8')}
            className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50
                     text-slate-300 text-sm hover:bg-slate-700 hover:border-slate-500
                     transition-all duration-200"
          >
            Tomorrow 8:00
          </button>
          <button
            onClick={() => handleQuickSelect('tomorrow-18')}
            className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50
                     text-slate-300 text-sm hover:bg-slate-700 hover:border-slate-500
                     transition-all duration-200"
          >
            Tomorrow 18:00
          </button>
        </div>
      </div>

      {/* Date and time inputs */}
      <div className="grid grid-cols-2 gap-4">
        {/* Date picker */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Date
          </label>
          <input
            type="date"
            value={formatDateInput(selectedDate)}
            onChange={handleDateChange}
            min={minDate}
            max={maxDate}
            className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50
                     text-white focus:outline-none focus:ring-2 focus:ring-blue-500
                     focus:border-transparent transition-all duration-200"
          />
        </div>

        {/* Time picker */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Time
          </label>
          <input
            type="time"
            value={formatTimeInput(selectedDate)}
            onChange={handleTimeChange}
            className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50
                     text-white focus:outline-none focus:ring-2 focus:ring-blue-500
                     focus:border-transparent transition-all duration-200"
          />
        </div>
      </div>

      {/* Selected time display */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
        <p className="text-sm text-slate-400">Departure time:</p>
        <p className="text-lg font-semibold text-white">
          {formatDisplayDate(selectedDate)} at {formatTimeInput(selectedDate)}
        </p>
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <p className="text-xs text-slate-500">
          💡 Deutsche Bahn data includes ICE, IC, RE, RB, S-Bahn, U-Bahn, Tram, and Bus connections across Germany.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4 md:pt-6">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          className="flex-1"
        >
          Find Routes
        </Button>
      </div>
    </div>
  )
}

export default DepartureTime
