# Run-Home App - Changelog

> **Last Updated:** January 9, 2026

---

## Version 0.4.0 (January 9, 2026) - Algorithm Rework & UI Polish

### 🔄 Algorithm Rework

#### Simplified Route Discovery
- **OSM-Only Station Discovery:** Replaced dual DB/OSM approach with OSM Overpass API only
- **Annulus Search:** Searches for stations between 50%-100% of target distance (inner/outer radius)
- **Adaptive Tolerance:** Starts at 10%, relaxes to 20%, then 30% if not enough routes found
- **5 Routes Per Page:** Increased from 3 to show more options

#### Lazy Transit Loading
- Transit directions now loaded on-demand when user selects a route
- Faster initial load time with station discovery only

### ✨ UI Improvements

#### Elevation Profile Enhancements
- **Increased Height:** 180px for better visibility
- **More Data Points:** 100 points (up from 50) via batched API requests
- **Gaussian Smoothing:** Removes spikes while preserving shape (9-point window)
- **Full-km X-axis Ticks:** Shows 0, 1, 2, 3... instead of decimals
- **Fixed Aspect Ratio:** Canvas now renders correctly without stretching
- **Fixed Mouse Tracking:** Hover line now aligns correctly with cursor

#### Map Popup Styling
- Dark theme popups matching app design
- Removed close button for cleaner look
- Fixed text colors for dark background

### 🐛 Bug Fixes

#### MapLibre Fixes
- Fixed WebGL context check that was blocking route rendering
- Added event handler cleanup to prevent memory leaks
- Fixed route handlers accumulating on re-renders

### 🛠️ Developer Tools

#### Debug Page
- New `/run-home/debug` route to test MapLibre directly
- Pre-configured test locations (Berlin, Munich, Hamburg, Frankfurt)
- Configurable distance, activity, and direction
- Bypass wizard flow for faster iteration

### 📚 Documentation

- Added `docs/ALGORITHM_DESIGN.md` with complete algorithm flow documentation

---

## Version 0.3.0 (January 8, 2026) - Stability & Polish

### 🐛 Bug Fixes

#### Fixed Routes Disappearing
- **Problem:** Routes would vanish after a few seconds due to useEffect race condition
- **Solution:** Added `isCalculatingRef` to prevent duplicate calculations, simplified useEffect dependencies

#### Fixed Elevation API Reliability
- **Problem:** Open-Elevation API was unreliable (timeouts, 500 errors)
- **Solution:** Switched to Open-Meteo API (free, stable, no rate limits)

#### Fixed Excessive Re-renders
- **Problem:** RouteResults component re-rendering excessively, causing poor UX
- **Solution:** Added `useCallback`, `useMemo`, `memo` wrappers and fixed useEffect dependencies

#### Fixed Elevation Profile ↔ Map Hover Sync
- **Problem:** Hovering on elevation chart didn't show marker on map
- **Root Cause:** Falsy check failed for coordinate value `0`, missing pane/key props
- **Solution:** Fixed type checking, added proper `pane="markerPane"` and dynamic `key`

### ✨ Improvements

#### GPX Export with Elevation
- GPX files now include `<ele>` tags for each trackpoint
- Compatible with Strava, Garmin Connect, Komoot

#### Direct Route Mode
- When DB API is unavailable, app generates waypoints based on distance/direction
- Users can still get route suggestions without transit info

---

## Version 0.2.0 (January 8, 2026) - Germany + Deutsche Bahn Update

### 🇩🇪 Major Changes

#### Switched to Deutsche Bahn API
- **New Service:** `src/services/deutschebahn.js` - Complete integration with DB REST API
- **Transit Data Source:** Now uses `v6.db.transport.rest` (with v5 fallback)
- **Coverage:** Germany only (ICE, IC, RE, RB, S-Bahn, U-Bahn, Tram, Bus)
- **Real-time Data:** Includes delays, cancellations, and platform information

#### New Departure Time Step (replaces Transit Types)
- **Date/Time Picker:** Select when you want to travel
- **Quick Select Buttons:** "Now", "In 30 min", "In 1 hour", "Tomorrow 8:00", "Tomorrow 18:00"
- **Time-based Routing:** DB API provides journey options based on departure time

#### Enhanced Route Cards with Transit Details
- **Journey Legs:** Shows complete transit journey TO each starting point
- **Train Numbers:** ICE 123, RE 456, S1, U2, etc.
- **Departure Times:** With real-time delay information (+5 min in red)
- **Platforms:** Platform numbers when available
- **Walking Segments:** Shows walking distance and time between stations

#### Germany-Only Restriction
- **Bounding Box Validation:** Coordinates must be within Germany
- **Nominatim Filter:** `countrycodes=de` restricts address search
- **User Notice:** Clear "🇩🇪 Germany only" notice in HomeLocation step

### 🔧 Technical Changes

#### Routing API Switch
- **Before:** OSRM demo server (same routes for all profiles)
- **After:** OSRM.de servers with proper foot/bike routing
  - `routing.openstreetmap.de/routed-foot/` for pedestrians
  - `routing.openstreetmap.de/routed-bike/` for cyclists

#### Removed Overpass API Dependency
- No longer uses Overpass for transit stops
- Cleaner architecture with single transit data source (DB API)

---

## Version 0.1.0 (Initial Development)

### Features Implemented

#### Core Wizard Flow
- ✅ **Step 1: Home Location** - Set home via map click, search (Nominatim), or geolocation
- ✅ **Step 2: Distance Selection** - Slider (2-150km) with quick-select buttons
- ✅ **Step 3: Activity Type** - Choose between Run 🏃 or Bike 🚴
- ✅ **Step 4: Departure Time** - Select when to travel
- ✅ **Step 5: Direction** - Compass selector for N/E/S/W or "Any"
- ✅ **Step 6: Route Results** - Display matching routes with transit details

#### Route Discovery
- ✅ Transit stop search via Deutsche Bahn API
- ✅ Journey planning (transit connections to starting points)
- ✅ Direction filtering by cardinal direction from home
- ✅ Distance filtering (±15% of target)
- ✅ Route calculation via OSRM (foot/bike profiles)
- ✅ Pagination (3 routes at a time with "Generate More")

#### Route Details
- ✅ Transit directions with line badges
- ✅ Route selection/highlighting on map
- ✅ Auto-zoom to selected route bounds

#### Elevation Profile
- ✅ Open-Meteo API for elevation data
- ✅ Interactive Recharts area chart
- ✅ Elevation gain/loss statistics
- ✅ Hover sync with map marker

#### GPX Export
- ✅ GPX generation with elevation data
- ✅ One-click download with descriptive filename

#### UI/UX
- ✅ Dark glassmorphic theme
- ✅ Responsive design
- ✅ Loading states with spinners
- ✅ Error handling with retry options

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Framework | React 18 |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 3.4 |
| Maps | Leaflet + react-leaflet |
| Charts | Recharts 3.6 |
| Icons | Lucide React |

## External APIs

| API | Purpose | Notes |
|-----|---------|-------|
| OpenStreetMap Tiles | Map display (CartoDB Dark Matter) | Free |
| Nominatim | Address search/geocoding | Germany only |
| Deutsche Bahn REST | Transit stops & journeys | Free, 100 req/min |
| OSRM.de | Route calculation | Free, foot/bike profiles |
| Open-Meteo | Elevation data | Free, reliable |

---

## File Structure

```
src/
├── App.jsx                 # Root component with state
├── main.jsx               # Entry point
├── index.css              # Global styles + Tailwind
│
├── components/
│   ├── Wizard.jsx         # Step controller
│   ├── ProgressBar.jsx    # Step indicator
│   ├── Map.jsx            # Leaflet map wrapper
│   ├── ElevationProfile.jsx # Recharts elevation chart
│   │
│   ├── steps/
│   │   ├── HomeLocation.jsx
│   │   ├── DistanceSelect.jsx
│   │   ├── ActivitySelect.jsx
│   │   ├── DepartureTime.jsx    # Replaces TransitType
│   │   ├── DirectionSelect.jsx
│   │   └── RouteResults.jsx
│   │
│   └── ui/
│       ├── Button.jsx
│       ├── Checkbox.jsx
│       ├── CompassSelector.jsx
│       ├── RadioCard.jsx
│       └── Slider.jsx
│
├── services/
│   ├── deutschebahn.js    # DB REST API integration
│   ├── elevation.js       # Open-Meteo elevation API
│   ├── geo.js             # Geometry utilities
│   ├── gpx.js             # GPX generation
│   ├── nominatim.js       # Address geocoding
│   └── osrm.js            # Route calculation
│
├── hooks/
│   ├── useDebounce.js
│   └── useGeolocation.js
│
└── constants/
    └── defaults.js
```
