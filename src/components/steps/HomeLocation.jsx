import { useState, useEffect } from 'react'
import { MapPin, Search, Navigation, Loader2, AlertTriangle } from 'lucide-react'
import Button from '../ui/Button'
import Map from '../Map'
import { searchLocation } from '../../services/nominatim'
import { isInGermany } from '../../services/deutschebahn'
import { useDebounce } from '../../hooks/useDebounce'

function HomeLocation({ homeLocation, onUpdate, onNext }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState(null)

  const debouncedQuery = useDebounce(searchQuery, 500)

  // Search for locations when query changes
  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setSearchResults([])
      return
    }

    const search = async () => {
      setIsSearching(true)
      setError(null)
      try {
        const results = await searchLocation(debouncedQuery)
        setSearchResults(results)
      } catch (err) {
        setError('Failed to search. Please try again.')
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }

    search()
  }, [debouncedQuery])

  const handleSelectResult = (result) => {
    onUpdate({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
    })
    setSearchQuery('')
    setSearchResults([])
  }

  const handleMapClick = (latlng) => {
    // Check if location is in Germany
    if (!isInGermany(latlng.lat, latlng.lng)) {
      setError('Please select a location within Germany. This app currently only supports Deutsche Bahn transit data.')
      return
    }
    onUpdate({
      lat: latlng.lat,
      lng: latlng.lng,
      displayName: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`,
    })
    setError(null)
  }

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        // Check if location is in Germany
        if (!isInGermany(latitude, longitude)) {
          setError('Your current location is outside Germany. This app currently only supports Deutsche Bahn transit data. Please search for an address in Germany.')
          setIsLocating(false)
          return
        }
        onUpdate({
          lat: latitude,
          lng: longitude,
          displayName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        })
        setIsLocating(false)
      },
      (err) => {
        setError('Unable to get your location. Please search instead.')
        setIsLocating(false)
        console.error('Geolocation error:', err)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const canProceed = homeLocation !== null && isInGermany(homeLocation.lat, homeLocation.lng)

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Germany notice */}
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-2">
        <span className="text-lg">🇩🇪</span>
        <p className="text-sm text-blue-200">
          This app uses Deutsche Bahn data and is currently limited to <strong>Germany</strong>.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <input
          type="text"
          placeholder="Search for your home address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 md:py-4 rounded-xl bg-slate-700/50 backdrop-blur border border-slate-600/50
                     text-white placeholder-slate-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                     transition-all duration-200"
        />
      </div>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto border border-slate-700">
          {searchResults.map((result, index) => (
            <button
              key={result.place_id || index}
              onClick={() => handleSelectResult(result)}
              className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors
                         border-b border-slate-700 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-200 line-clamp-2">
                  {result.display_name}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Use my location button */}
      <button
        onClick={handleUseMyLocation}
        disabled={isLocating}
        className="w-full flex items-center justify-center gap-2 py-3 md:py-4 px-4 rounded-xl
                   bg-slate-700/50 backdrop-blur border border-slate-600/50
                   text-slate-200 font-medium
                   hover:bg-slate-700/70 transition-all duration-200
                   disabled:opacity-50"
      >
        {isLocating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Navigation className="w-5 h-5" />
        )}
        <span>{isLocating ? 'Getting location...' : 'Use my current location'}</span>
      </button>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg">
        <Map
          center={homeLocation ? [homeLocation.lat, homeLocation.lng] : [50.0, 10.0]}
          zoom={homeLocation ? 13 : 4}
          marker={homeLocation ? [homeLocation.lat, homeLocation.lng] : null}
          onClick={handleMapClick}
          className="h-64 md:h-80 lg:h-96 w-full"
        />
      </div>

      {/* Selected location display */}
      {homeLocation && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/20 border border-blue-500/30">
          <MapPin className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-300">Selected Location</p>
            <p className="text-xs text-blue-200/80 line-clamp-2">{homeLocation.displayName}</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4 md:pt-6">
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

export default HomeLocation
