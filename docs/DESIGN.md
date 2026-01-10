# Run-Home App - Design Document

> **Version:** 1.1
> **Date:** January 8, 2026
> **Status:** In Development (POC)

**Related Documents:**
- [CHANGELOG.md](./CHANGELOG.md) - Version history and session notes
- [TODO.md](./TODO.md) - Pending tasks and known issues

---

## 1. Overview

### 1.1 Product Vision
Run-Home is a web application that helps runners and cyclists plan their journey home from public transit stops. Users select their home location, desired distance, activity type, and direction, and the app suggests optimal routes from nearby transit stations back to their home.

### 1.2 Target Users
- Runners who want to incorporate their commute into training
- Cyclists looking for scenic routes home
- People who want to exercise while commuting
- European users (initial market focus)

### 1.3 Key Features
- Set home/endpoint location via map or search
- Choose custom distance (2-150 km)
- Select activity type (running or cycling)
- Filter by transit type (metro, train, bus, tram)
- Choose general direction (N, E, S, W)
- View and compare multiple route options
- **[NEW]** Interactive elevation profile with hover synchronization
- **[NEW]** GPX export for use in GPS devices/apps
- **[NEW]** Public transit directions for each route

---

## 2. Design Decisions (POC)

> These decisions apply to the Proof of Concept. They may be revisited for production.

### 2.1 Distance Tolerance
**Decision:** ±15% or 2km, whichever is greater

| Target Distance | Tolerance | Resulting Range |
|-----------------|-----------|-----------------|
| 5 km | 2 km (minimum) | 3 - 7 km |
| 10 km | 2 km (minimum) | 8 - 12 km |
| 20 km | 3 km (15%) | 17 - 23 km |
| 50 km | 7.5 km (15%) | 42.5 - 57.5 km |

### 2.2 Direction Options
**Decision:** 4 cardinal directions + "Any" option

- North, East, South, West (90° arcs each)
- "Any" option for users who only care about distance
- Keep UI simple, avoid analysis paralysis

### 2.3 Routing API Strategy
**Decision:** OSRM demo for development, plan for GraphHopper

| Phase | API | Notes |
|-------|-----|-------|
| Development/POC | OSRM Demo Server | Free, sufficient for testing |
| Production | GraphHopper Free Tier | 500 requests/day, more reliable |
| Scale-up | Self-hosted OSRM | If needed later |

### 2.4 Route Calculation Strategy
**Decision:** Lazy loading (calculate on click)

**Flow:**
1. Query Overpass for all matching transit stops
2. Display stops as markers on the map immediately
3. When user clicks a stop → calculate route via OSRM
4. Cache calculated routes in memory

**Benefits:**
- Fast initial load
- Avoids API rate limits
- Only calculates routes user cares about

### 2.5 State Persistence
**Decision:** localStorage for home location only

| Data | Persistence | Reason |
|------|-------------|--------|
| Home location | localStorage | Most valuable, rarely changes |
| Distance/Activity | Session only | Quick to re-select |
| Transit types | Session only | May vary by use case |
| Direction | Session only | Changes each time |

### 2.6 Mobile Map Interaction
**Decision:** Search bar primary, long-press for map

| Platform | Primary Method | Secondary Method |
|----------|---------------|------------------|
| Mobile | Search bar + "Use my location" | Long-press on map |
| Desktop | Click on map | Search bar |

### 2.7 Default Transit Types
**Decision:** Metro + Train selected by default

- Fewer, more useful stops (major transit hubs)
- Bus/Tram unchecked by default (too many stops in cities)
- User can enable if needed

### 2.8 Error Handling Strategy

| Error | Detection | User Message | Recovery |
|-------|-----------|--------------|----------|
| No transit stops found | Empty Overpass result | "No stops found. Try increasing distance or changing direction." | Adjust filters |
| OSRM rate limited | 429 response | "Route calculation is slow. Please wait..." | Retry with backoff |
| Overpass timeout | Timeout/500 error | "Search timed out. Trying smaller area..." | Retry with smaller radius |
| No internet | fetch fails | "No internet connection." | Retry button |
| No routes in range | All routes outside tolerance | "No routes match your distance. Showing closest options." | Show anyway, sorted |

---

## 3. User Flow

### Step 1: Set Home Location
**Purpose:** Define the endpoint (destination) for all routes

**UI Elements:**
- Interactive map (Leaflet with OSM tiles)
- Search bar with autocomplete (Nominatim geocoding) — **primary on mobile**
- "Use my location" button (browser geolocation API)
- Selected location marker on map
- Address display confirmation

**Interaction:**
- **Mobile:** Search bar is primary, long-press on map as secondary
- **Desktop:** Click on map is primary, search bar as alternative

**Validation:**
- Location must be within Europe
- Coordinates must be valid

**Persistence:** Home location saved to localStorage

**State Output:**
```javascript
{
  homeLocation: {
    lat: 52.5200,
    lng: 13.4050,
    displayName: "Berlin, Germany"
  }
}
```

---

### Step 2: Choose Distance
**Purpose:** Set the desired route distance

**UI Elements:**
- Range slider (2 km to 150 km)
- Numeric input for precise entry
- Quick-select buttons: 5, 10, 21 (half-marathon), 42 (marathon), 100 km
- Visual feedback showing the search radius on a mini-map (optional)

**Validation:**
- Minimum: 2 km
- Maximum: 150 km
- Step: 1 km

**State Output:**
```javascript
{
  distance: 25 // in kilometers
}
```

---

### Step 3: Choose Activity Type
**Purpose:** Determine routing profile and time estimates

**UI Elements:**
- Two large, visually distinct cards/buttons:
  - 🏃‍♂️ **Run** - Uses pedestrian/foot routing profile
  - 🚴 **Bike** - Uses cycling routing profile

**Behavior:**
- Single selection (radio-style)
- Visual highlight on selected option

**Impact on Routing:**
| Activity | OSRM Profile | Avg Speed Estimate |
|----------|--------------|-------------------|
| Run      | `foot`       | 6 min/km (10 km/h) |
| Bike     | `bike`       | 3 min/km (20 km/h) |

**State Output:**
```javascript
{
  activity: "run" | "bike"
}
```

---

### Step 4: Select Departure Time
**Purpose:** Set when you want to travel (for transit scheduling)

**UI Elements:**
- Date picker (calendar)
- Time picker (hour:minute)
- Quick-select buttons:
  - "Now"
  - "In 30 min"
  - "In 1 hour"
  - "Tomorrow 8:00"
  - "Tomorrow 18:00"

**Behavior:**
- Time is rounded to nearest 5 minutes
- Default: 15 minutes from now
- Used by Deutsche Bahn API to find transit connections

**Validation:**
- Departure time must be in the future
- Maximum: 7 days ahead (DB API limitation)

**State Output:**
```javascript
{
  departureTime: new Date() // JavaScript Date object
}
```

---

### Step 5: Choose Direction
**Purpose:** Filter transit stops to a specific cardinal direction from home

**UI Elements:**
- Compass-style selector with 5 options:
  ```
        [N]
     [W] [●] [E]    ← Center = "Any"
        [S]
  ```
- "Any" option in center for distance-only filtering
- Visual indicator showing the selected 90° arc (or full circle for "Any")
- Optional: Small map preview showing the search area

**Direction Calculation:**
| Direction | Bearing Range | Description |
|-----------|---------------|-------------|
| North     | 315° - 45°    | Stops north of home |
| East      | 45° - 135°    | Stops east of home |
| South     | 135° - 225°   | Stops south of home |
| West      | 225° - 315°   | Stops west of home |
| Any       | 0° - 360°     | All directions (distance only) |

**Bearing Formula:**
```javascript
function calculateBearing(homeLat, homeLng, stopLat, stopLng) {
  const dLng = toRad(stopLng - homeLng);
  const lat1 = toRad(homeLat);
  const lat2 = toRad(stopLat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
```

**State Output:**
```javascript
{
  direction: "north" | "east" | "south" | "west" | "any"
}
```

---

### Step 6: View Routes
**Purpose:** Display matching transit stops and routes back home

**UI Elements:**
1. **Full-screen map showing:**
   - Home location marker (distinct icon)
   - Transit stop markers (color-coded by route)
   - Route polylines (color-coded, clickable)
   - **[NEW]** Hovered point marker (synced with elevation profile)

2. **Route list panel (scrollable cards):**
   - Shows 3 routes at a time with "Generate More" button
   - Each route card shows:
     - Transit stop name with type icon
     - Route distance and estimated duration
     - **[NEW]** Public transit directions (lines, destinations)
     - **[NEW]** Transit line badges with colors
   - Click to expand route card and highlight on map

3. **Expanded Route Details:**
   - **[NEW]** Interactive elevation profile (Recharts)
   - **[NEW]** Elevation gain/loss statistics
   - **[NEW]** GPX download button
   - Activity type reminder

4. **Actions:**
   - "Generate More Routes" → Show different stops
   - "Start Over" button → Return to Step 1
   - **[NEW]** "Download GPX" → Export for GPS devices

**Data Processing:**
1. Query Overpass API for transit stops matching criteria
2. Filter stops by direction (bearing from home), unless "Any" selected
3. Calculate routes via OSRM (foot or bike profile)
4. Filter routes by distance tolerance (±15%)
5. Fetch transit line info for each stop
6. **[NEW]** Fetch elevation profile when route is selected
7. Show only 3 routes at a time for performance

**State Output:**
```javascript
{
  calculatedRoutes: [
    {
      stop: {
        id: "node/123456",
        name: "Alexanderplatz",
        type: "metro",
        lat: 52.5219,
        lng: 13.4132
      },
      route: {
        distance: 24800, // meters
        duration: 4800,  // seconds
        geometry: { coordinates: [...] }, // GeoJSON
      },
      color: "#3b82f6",
      transitLines: [
        { id: "...", ref: "U2", color: "#ff3300" },
        { id: "...", ref: "S5", color: "#ff6600" }
      ],
      directions: "Take U2 towards Ruhleben or S5 towards..."
    },
    // ... more routes
  ],
  selectedRouteIndex: 0, // Currently expanded route
  hoveredPoint: { lat, lng, elevation, distance } // From elevation profile
}
```

---

## 3. Technical Architecture

### 3.1 System Overview
```
┌────────────────────────────────────────────────────────────────┐
│                        Frontend (SPA)                          │
│                     React + Vite + Tailwind                    │
├────────────────────────────────────────────────────────────────┤
│  Components          │  Services           │  State            │
│  ─────────────────   │  ─────────────────  │  ───────────────  │
│  Wizard              │  Overpass API       │  React useState   │
│  Map                 │  OSRM Routing       │  (or Zustand)     │
│  Step Components     │  Nominatim Geocode  │                   │
│  Route Display       │  Geo Utilities      │                   │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     External APIs (Free)                        │
├──────────────────┬──────────────────┬──────────────────────────┤
│  OpenStreetMap   │  Overpass API    │  OSRM Demo Server        │
│  Tile Server     │  (Transit Data)  │  (Routing)               │
│                  │                  │                          │
│  Nominatim       │                  │                          │
│  (Geocoding)     │                  │                          │
└──────────────────┴──────────────────┴──────────────────────────┘
```

### 3.2 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | React 18 | UI components and state |
| Build Tool | Vite 6 | Fast development and bundling |
| Styling | Tailwind CSS 3.4 | Utility-first styling |
| Maps | Leaflet + react-leaflet | Interactive maps |
| Charts | Recharts 3.6 | Elevation profile visualization |
| Icons | Lucide React | Consistent iconography |
| HTTP Client | fetch (native) | API requests |
| Deployment | Vercel / Netlify | Static hosting |

### 3.3 External APIs

#### OpenStreetMap Tiles
- **URL:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Rate Limit:** Reasonable use policy
- **Cost:** Free
- **Attribution Required:** Yes

#### Nominatim (Geocoding)
- **URL:** `https://nominatim.openstreetmap.org/search`
- **Rate Limit:** 1 request/second
- **Cost:** Free
- **Usage:** Address search in Step 1

#### Overpass API (Transit Data)
- **URL:** `https://overpass-api.de/api/interpreter`
- **Rate Limit:** ~10,000 requests/day (fair use)
- **Cost:** Free
- **Usage:** Query transit stops in Step 6

#### OSRM (Routing)
- **URL:** `https://router.project-osrm.org/route/v1`
- **Rate Limit:** Demo server, not for heavy production
- **Cost:** Free
- **Profiles:** `foot`, `bike`, `car`
- **Usage:** Calculate routes in Step 6

#### Open-Elevation API (Elevation Data)
- **URL:** `https://api.open-elevation.com/api/v1/lookup`
- **Rate Limit:** Fair use, batch requests supported
- **Cost:** Free
- **Usage:** Fetch elevation profile for routes
- **Note:** Limited resolution; consider Open-Topo-Data for production

---

## 4. Project Structure

```
run-home/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── README.md
│
├── docs/
│   ├── DESIGN.md                 # This document
│   ├── CHANGELOG.md              # Version history
│   └── TODO.md                   # Pending tasks
│   └── finished/                 # Archived implemented design specs (MapLibre, Route Editor)
│
├── public/
│   ├── favicon.svg
│   └── icons/
│       ├── run.svg
│       └── bike.svg
│
└── src/
    ├── main.jsx                  # App entry point
    ├── App.jsx                   # Root component
    ├── index.css                 # Global styles + Tailwind
    │
    ├── components/
    │   ├── Wizard.jsx            # Step controller/navigator
    │   ├── ProgressBar.jsx       # Step progress indicator
    │   ├── Map.jsx               # Reusable Leaflet map (with hover point)
    │   ├── ElevationProfile.jsx  # Interactive elevation chart (Recharts)
    │   │
    │   ├── steps/
    │   │   ├── HomeLocation.jsx  # Step 1
    │   │   ├── DistanceSelect.jsx # Step 2
    │   │   ├── ActivitySelect.jsx # Step 3
    │   │   ├── TransitType.jsx   # Step 4
    │   │   ├── DirectionSelect.jsx # Step 5
    │   │   └── RouteResults.jsx  # Step 6 (routes, elevation, GPX)
    │   │
    │   └── ui/
    │       ├── Button.jsx
    │       ├── Slider.jsx
    │       ├── Checkbox.jsx
    │       ├── RadioCard.jsx
    │       └── CompassSelector.jsx
    │
    ├── services/
    │   ├── deutschebahn.js       # DB REST API (transit stops + journeys)
    │   ├── osrm.js               # Route calculation (OSRM.de)
    │   ├── nominatim.js          # Geocoding (Germany only)
    │   ├── geo.js                # Bearing, distance utils
    │   ├── elevation.js          # Elevation profile (Open-Meteo API)
    │   └── gpx.js                # GPX file generation with elevation
    │
    ├── hooks/
    │   ├── useGeolocation.js     # Browser location hook
    │   └── useDebounce.js        # Input debouncing
    │
    └── constants/
        └── defaults.js           # Default values
```

---

## 5. State Management

### 5.1 Wizard State
```javascript
const [wizardState, setWizardState] = useState({
  currentStep: 1,

  // Step 1: Home Location
  homeLocation: null, // { lat, lng, displayName }

  // Step 2: Distance
  distance: 10, // km (default)

  // Step 3: Activity
  activity: 'run', // 'run' | 'bike'

  // Step 4: Departure Time (replaces Transit Types)
  departureTime: getDefaultDepartureTime(), // Date object

  // Step 5: Direction
  direction: null, // 'north' | 'east' | 'south' | 'west' | 'any'

  // Step 6 (computed)
  transitStops: [],
  routes: [],
  routeCache: {}, // Cache: { [stopId]: routeData }
  isLoading: false,
  error: null,
});

// Default departure time: now + 15 min, rounded to 5 min
function getDefaultDepartureTime() {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5 + 15);
  now.setSeconds(0);
  return now;
}
```

### 5.2 Step Validation
```javascript
const canProceed = {
  1: () => wizardState.homeLocation !== null,
  2: () => wizardState.distance >= 2 && wizardState.distance <= 150,
  3: () => ['run', 'bike'].includes(wizardState.activity),
  4: () => wizardState.departureTime instanceof Date,
  5: () => ['north', 'east', 'south', 'west', 'any'].includes(wizardState.direction),
};
```

### 5.3 localStorage Persistence
```javascript
// On app load
const savedHome = localStorage.getItem('runhome_homeLocation');
if (savedHome) {
  setWizardState(prev => ({
    ...prev,
    homeLocation: JSON.parse(savedHome)
  }));
}

// On home location change
useEffect(() => {
  if (wizardState.homeLocation) {
    localStorage.setItem('runhome_homeLocation',
      JSON.stringify(wizardState.homeLocation));
  }
}, [wizardState.homeLocation]);
```

---

## 6. API Integration Details

### 6.1 Overpass Query Example
```javascript
// Query for metro and train stations within 25km of a point
const query = `
[out:json][timeout:30];
(
  node["railway"="station"]["station"="subway"]
    (around:25000, 52.5200, 13.4050);
  node["railway"="station"]
    (around:25000, 52.5200, 13.4050);
);
out body;
`;
```

### 6.2 OSRM Route Request
```javascript
// Get walking route from transit stop to home
const url = `https://router.project-osrm.org/route/v1/foot/` +
  `${stopLng},${stopLat};${homeLng},${homeLat}` +
  `?overview=full&geometries=geojson`;
```

### 6.3 Nominatim Search
```javascript
const url = `https://nominatim.openstreetmap.org/search` +
  `?q=${encodeURIComponent(query)}` +
  `&format=json&limit=5&addressdetails=1` +
  `&viewbox=-10,35,40,70&bounded=1`; // Europe bounding box
```

### 6.4 Open-Elevation Request (NEW)
```javascript
// Fetch elevation for route coordinates
const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    locations: coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
  })
});
```

### 6.5 GPX Generation (NEW)
```javascript
// Generate GPX XML from route
function generateGPX(route, stop, home, activity) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Run-Home App">
  <metadata>
    <name>Route from ${stop.name} to Home</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${activity === 'run' ? 'Running' : 'Cycling'} Route</name>
    <trkseg>
      ${route.geometry.coordinates.map(([lng, lat]) =>
        `<trkpt lat="${lat}" lon="${lng}"></trkpt>`
      ).join('\n      ')}
    </trkseg>
  </trk>
</gpx>`;
}
```

### 6.6 Transit Lines Query (NEW)
```javascript
// Fetch transit lines serving a stop
const query = `
[out:json][timeout:10];
node(${stopId});
rel(bn)["route"~"bus|tram|subway|train"];
out tags;
`;
```

---

## 7. UI/UX Guidelines

### 7.1 Design Principles
1. **One thing at a time** - Each step has a single focused task
2. **Clear progress** - Always show where user is in the flow
3. **Easy navigation** - Back button always available
4. **Mobile first** - Design for touch, works on desktop
5. **Fast feedback** - Loading states, instant visual updates

### 7.2 Visual Design System

**Style:** Dark Glassmorphism (Updated from light theme)

Combines frosted glass effects with generous whitespace and smooth micro-interactions for a modern, premium feel.

#### Background
```css
/* Soft gradient background */
.app-background {
  @apply min-h-screen;
  background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 50%, #ede9fe 100%);
  /* blue-100 → indigo-100 → violet-100 */
}
```

#### Glassmorphism Cards
```css
/* Primary card style - frosted glass effect */
.glass-card {
  @apply backdrop-blur-xl bg-white/70
         border border-white/50
         rounded-2xl shadow-lg;
}

/* Elevated card - more prominent */
.glass-card-elevated {
  @apply backdrop-blur-xl bg-white/80
         border border-white/60
         rounded-3xl shadow-xl;
}
```

### 7.3 Color Palette

```css
/* Tailwind classes to use */

/* Primary Actions */
--primary: blue-500 (#3b82f6)
--primary-hover: blue-600 (#2563eb)
--primary-light: blue-100 (#dbeafe)

/* Activity Colors */
--run: emerald-500 (#10b981)
--run-gradient: from-green-400 to-emerald-500
--bike: orange-500 (#f97316)
--bike-gradient: from-orange-400 to-amber-500

/* Backgrounds */
--bg-gradient-from: blue-100 (#dbeafe)
--bg-gradient-via: indigo-100 (#e0e7ff)
--bg-gradient-to: violet-100 (#ede9fe)

/* Surfaces */
--card-bg: white/70 (rgba(255,255,255,0.7))
--card-border: white/50 (rgba(255,255,255,0.5))

/* Text */
--text-primary: slate-800 (#1e293b)
--text-secondary: slate-500 (#64748b)
--text-muted: slate-400 (#94a3b8)

/* Semantic */
--success: emerald-500
--warning: amber-500
--error: red-500
```

### 7.4 Typography

**Font Stack:** Inter (Google Fonts)
```css
/* Import in index.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', system-ui, sans-serif;
}
```

**Scale:**
| Element | Class | Size |
|---------|-------|------|
| Page Title | `text-2xl font-bold` | 24px |
| Step Title | `text-xl font-semibold` | 20px |
| Body | `text-base` | 16px |
| Label | `text-sm font-medium` | 14px |
| Caption | `text-xs text-slate-500` | 12px |

### 7.5 Component Styles

#### Primary Button
```jsx
<button className="
  bg-gradient-to-r from-blue-500 to-indigo-500
  text-white font-semibold
  py-3 px-6 rounded-xl
  shadow-lg shadow-blue-500/25
  hover:shadow-xl hover:shadow-blue-500/30
  hover:-translate-y-0.5
  active:translate-y-0
  transition-all duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Continue
</button>
```

#### Secondary Button
```jsx
<button className="
  bg-white/50 backdrop-blur
  text-slate-700 font-medium
  py-3 px-6 rounded-xl
  border border-white/50
  hover:bg-white/70
  transition-all duration-200
">
  Back
</button>
```

#### Activity Card (Run)
```jsx
<button className="
  bg-gradient-to-br from-green-400 to-emerald-500
  text-white
  p-6 rounded-2xl
  shadow-lg shadow-emerald-500/25
  hover:shadow-xl hover:shadow-emerald-500/30
  hover:scale-[1.02]
  active:scale-100
  transition-all duration-200
  flex flex-col items-center gap-2
">
  <span className="text-4xl">🏃‍♂️</span>
  <span className="font-semibold text-lg">Run</span>
</button>
```

#### Activity Card (Bike)
```jsx
<button className="
  bg-gradient-to-br from-orange-400 to-amber-500
  text-white
  p-6 rounded-2xl
  shadow-lg shadow-orange-500/25
  hover:shadow-xl hover:shadow-orange-500/30
  hover:scale-[1.02]
  active:scale-100
  transition-all duration-200
  flex flex-col items-center gap-2
">
  <span className="text-4xl">🚴</span>
  <span className="font-semibold text-lg">Bike</span>
</button>
```

#### Checkbox / Toggle Item
```jsx
<label className="
  flex items-center gap-3
  p-4 rounded-xl
  bg-white/50 backdrop-blur
  border border-white/50
  hover:bg-white/70
  cursor-pointer
  transition-all duration-200
  has-[:checked]:bg-blue-50
  has-[:checked]:border-blue-200
">
  <input type="checkbox" className="
    w-5 h-5 rounded
    text-blue-500
    focus:ring-blue-500/25
  " />
  <span className="font-medium text-slate-700">Metro</span>
</label>
```

#### Distance Quick-Select Pills
```jsx
<button className="
  px-4 py-2 rounded-full
  bg-white/50 backdrop-blur
  border border-white/50
  text-slate-600 font-medium
  hover:bg-white/70
  transition-all duration-200

  /* Selected state */
  data-[selected=true]:bg-blue-500
  data-[selected=true]:text-white
  data-[selected=true]:border-blue-500
">
  10 km
</button>
```

#### Compass Direction Button
```jsx
<button className="
  w-14 h-14 rounded-xl
  bg-white/50 backdrop-blur
  border border-white/50
  text-slate-600 font-bold text-lg
  hover:bg-white/70
  transition-all duration-200

  /* Selected state */
  data-[selected=true]:bg-gradient-to-br
  data-[selected=true]:from-blue-500
  data-[selected=true]:to-indigo-500
  data-[selected=true]:text-white
  data-[selected=true]:shadow-lg
  data-[selected=true]:shadow-blue-500/25
">
  N
</button>
```

### 7.6 Animation & Transitions

**Default Transition:**
```css
transition-all duration-200 ease-out
```

**Hover Lift Effect:**
```css
hover:-translate-y-0.5
hover:shadow-xl
transition-all duration-200
```

**Page/Step Transitions:**
```jsx
// Use Framer Motion or CSS for step transitions
.step-enter {
  opacity: 0;
  transform: translateX(20px);
}
.step-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: all 300ms ease-out;
}
.step-exit {
  opacity: 1;
}
.step-exit-active {
  opacity: 0;
  transform: translateX(-20px);
  transition: all 300ms ease-in;
}
```

**Loading Spinner:**
```jsx
<div className="
  w-6 h-6
  border-2 border-blue-500/30
  border-t-blue-500
  rounded-full
  animate-spin
" />
```

### 7.7 Spacing System

Use Tailwind's default spacing scale consistently:

| Use Case | Spacing |
|----------|---------|
| Card padding | `p-6` (24px) |
| Section gap | `gap-6` or `space-y-6` |
| Element gap (buttons, inputs) | `gap-4` (16px) |
| Inline element gap | `gap-2` (8px) |
| Page margins (mobile) | `px-4` (16px) |
| Page margins (desktop) | `px-6` or container |

### 7.8 Responsive Breakpoints
```css
/* Mobile first */
sm: 640px   /* Large phones */
md: 768px   /* Tablets */
lg: 1024px  /* Desktops */
```

### 7.9 Layout Structure

```jsx
// App shell
<div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
  {/* Content container */}
  <div className="max-w-lg mx-auto px-4 py-8">

    {/* Progress bar */}
    <div className="mb-8">
      <ProgressBar step={currentStep} totalSteps={6} />
    </div>

    {/* Glass card with step content */}
    <div className="backdrop-blur-xl bg-white/70 border border-white/50 rounded-3xl shadow-xl p-6">

      {/* Step title */}
      <h1 className="text-xl font-semibold text-slate-800 mb-6">
        Set Your Home Location
      </h1>

      {/* Step content */}
      <div className="space-y-4">
        {/* ... */}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-8">
        <button className="...">Back</button>
        <button className="...">Continue</button>
      </div>

    </div>
  </div>
</div>
```

### 7.10 Map Styling

```jsx
// Map container with dark glass effect border
<div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg">
  <MapContainer
    className="h-72 md:h-80 lg:h-96 w-full"
    // ... leaflet props
  />
</div>

// Dark map tiles - CartoDB Dark Matter
const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
```

### 7.11 Elevation Profile Styling (NEW)

```jsx
// Recharts-based elevation profile
<ResponsiveContainer width="100%" height={128}>
  <AreaChart data={chartData} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
    <defs>
      <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={color} stopOpacity={0.4} />
        <stop offset="95%" stopColor={color} stopOpacity={0.05} />
      </linearGradient>
    </defs>
    <Area
      type="monotone"
      dataKey="elevation"
      stroke={color}
      strokeWidth={2}
      fill="url(#gradient)"
      activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
    />
    <Tooltip content={<CustomTooltip />} />
  </AreaChart>
</ResponsiveContainer>
```

### 7.12 Route Card Expansion (NEW)

```jsx
// Expandable route card with selection highlight
<div className={`
  rounded-xl transition-all duration-300 overflow-hidden
  ${isSelected
    ? 'bg-slate-700/90 border-2 border-blue-500 ring-2 ring-blue-500/20'
    : 'bg-slate-700/50 border border-slate-600/50 hover:bg-slate-700/70'
  }
`}>
  {/* Header - always visible */}
  <button onClick={toggleExpand} className="w-full p-4 text-left">
    {/* Stop name, distance, duration, transit lines */}
  </button>

  {/* Expanded content */}
  {isSelected && (
    <div className="px-4 pb-4 border-t border-slate-600/30 pt-4">
      <ElevationProfile route={route} color={color} onHoverPoint={setHoveredPoint} />
      <button className="gpx-download-btn">Download GPX</button>
    </div>
  )}
</div>
```

---

## 8. Future Enhancements (Post-MVP)

### Phase 2
- [ ] Save favorite home locations
- [x] Route elevation profile display ✅ *Implemented Jan 8, 2026*
- [ ] Share route via link
- [x] Export to GPX file ✅ *Implemented Jan 8, 2026*
- [ ] **[NEW]** Route editing with draggable waypoints
- [ ] **[NEW]** Higher resolution elevation data

### Phase 3
- [ ] User accounts (optional backend)
- [ ] Save and view past routes
- [ ] Route ratings and comments
- [ ] Integration with Strava/Garmin

### Phase 4
- [ ] "Scenic route" preference (parks, water, etc.)
- [ ] Avoid busy roads option
- [ ] Weather integration
- [ ] Multi-stop routes (run between transit stations)

---

## 9. Development Milestones

### Milestone 1: Project Setup ✅
- [x] Initialize Vite + React project
- [x] Configure Tailwind CSS
- [x] Set up project structure
- [x] Create basic component shells

### Milestone 2: Core UI ✅
- [x] Implement Wizard component
- [x] Build all 6 step components (static UI)
- [x] Add navigation (next/back)
- [x] Progress indicator

### Milestone 3: Map Integration ✅
- [x] Integrate Leaflet
- [x] Home location selection (click + search)
- [x] Browser geolocation

### Milestone 4: API Services ✅
- [x] Implement Overpass service
- [x] Implement OSRM service
- [x] Implement Nominatim service
- [x] Geo utility functions

### Milestone 5: Full Flow ✅
- [x] Connect all steps with state
- [x] Query transit stops
- [x] Calculate and display routes
- [x] Route list and map display
- [x] Distance filtering (±15%)
- [x] Route pagination (3 at a time)

### Milestone 6: Polish (In Progress)
- [x] Loading states
- [x] Error handling
- [x] Mobile responsiveness
- [x] Dark theme implementation
- [ ] Performance optimization (re-renders)

### Milestone 7: Enhanced Features (NEW - In Progress)
- [x] Elevation profile display (Recharts)
- [x] Elevation gain/loss statistics
- [x] GPX export functionality
- [x] Transit line info and directions
- [ ] Elevation ↔ Map hover synchronization (bug)
- [ ] Route editing with waypoints
- [ ] Higher resolution elevation data

### Milestone 6: Polish
- Loading states
- Error handling
- Mobile responsiveness
- Performance optimization

---

## 10. Appendix

### A. OSM Transit Tags Reference
| Type | Primary Tag | Additional Filters |
|------|-------------|-------------------|
| Subway Station | `railway=station` | `station=subway` |
| Subway Entrance | `railway=subway_entrance` | - |
| Train Station | `railway=station` | `station!=subway` |
| Train Halt | `railway=halt` | - |
| Bus Stop | `highway=bus_stop` | - |
| Bus Platform | `public_transport=platform` | `bus=yes` |
| Tram Stop | `railway=tram_stop` | - |
| Tram Platform | `public_transport=platform` | `tram=yes` |

### B. Europe Bounding Box
```
North: 71.0 (North Cape, Norway)
South: 35.0 (Southern Spain/Greece)
West: -10.0 (Portugal)
East: 40.0 (Eastern Europe/Turkey border)
```

### C. Distance/Time Estimates
| Activity | Pace | 10km Time | 25km Time | 50km Time |
|----------|------|-----------|-----------|-----------|
| Run (easy) | 6:00/km | 1h 00m | 2h 30m | 5h 00m |
| Run (moderate) | 5:00/km | 50m | 2h 05m | 4h 10m |
| Bike (casual) | 3:00/km | 30m | 1h 15m | 2h 30m |
| Bike (fast) | 2:00/km | 20m | 50m | 1h 40m |
```
