# Feature Spec: MapLibre Migration + Full-Page Map Layout

> **Status:** Draft
> **Created:** January 8, 2026
> **Author:** Copilot + User

---

## Overview

Migrate from React-Leaflet to MapLibre GL JS and redesign the route results view from a stacked layout to a full-page immersive map experience with floating route cards and a slide-out detail panel.

---

## Current State

```
┌─────────────────────────────────┐
│         Header/Progress         │
├─────────────────────────────────┤
│                                 │
│     Small Map (h-72/h-96)       │
│                                 │
├─────────────────────────────────┤
│     Route Card 1                │
├─────────────────────────────────┤
│     Route Card 2                │
├─────────────────────────────────┤
│     Route Card 3                │
├─────────────────────────────────┤
│     [Generate More] Button      │
└─────────────────────────────────┘
```

**Issues with current design:**
- Map is too small to appreciate routes
- Scrolling between map and cards breaks context
- Mobile experience is cramped
- Can't compare routes visually on map

---

## Proposed Design

### Desktop Layout (≥1024px)

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Back                         Run Home                    [?]   │
├────────────────────────────────────────────────────────────────────┤
│                                                    ┌──────────────┐│
│                                                    │ Route 1      ││
│                                                    │ 🚂 → 5.2km   ││
│                                                    │ ~42 min      ││
│                 FULL PAGE MAP                      └──────────────┘│
│                                                    ┌──────────────┐│
│              (All routes visible)                  │ Route 2      ││
│                                                    │ 🚂 → 4.8km   ││
│                                                    │ ~38 min      ││
│                   🏠 Home                          └──────────────┘│
│                                                    ┌──────────────┐│
│                                                    │ Route 3      ││
│                                                    │ 🚂 → 5.5km   ││
│                                                    │ ~45 min      ││
│                                                    └──────────────┘│
│                                                                    │
│                                                    [+ More Routes] │
└────────────────────────────────────────────────────────────────────┘
```

### Desktop with Detail Panel Open

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Back                         Run Home                    [?]   │
├────────────────────────────────────────────────────────────────────┤
│                                      │                             │
│                                      │  ✕  Route Details           │
│                                      │                             │
│                                      │  🚂 Alexanderplatz          │
│         MAP (zoomed to              │  ─────────────────────────  │
│          selected route)             │  Distance: 5.2 km           │
│                                      │  Duration: ~42 min          │
│                                      │  ─────────────────────────  │
│              Route                   │                             │
│            highlighted               │  📊 Elevation Profile       │
│                                      │  ┌─────────────────────┐   │
│                                      │  │    ╱╲    ╱╲         │   │
│               🏠                     │  │   ╱  ╲  ╱  ╲___     │   │
│                                      │  │  ╱    ╲╱           │   │
│                                      │  └─────────────────────┘   │
│                                      │  ↑ 45m  ↓ 62m              │
│                                      │                             │
│                                      │  🚆 Transit Details         │
│                                      │  • S3 → Alexanderplatz     │
│                                      │  • Depart 14:32 Pl. 2      │
│                                      │                             │
│                                      │  [Download GPX]             │
│                                      │                             │
└────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout (<768px)

```
┌─────────────────────┐
│ ← Back    Run Home  │
├─────────────────────┤
│                     │
│                     │
│    FULL PAGE MAP    │
│                     │
│        🏠           │
│                     │
│                     │
├─────────────────────┤
│ ▲ 3 Routes Found    │  ← Draggable bottom sheet
└─────────────────────┘

   (Drag up to expand)

┌─────────────────────┐
│ ▼ 3 Routes Found    │
├─────────────────────┤
│ Route 1 - 5.2km     │
├─────────────────────┤
│ Route 2 - 4.8km     │
├─────────────────────┤
│ Route 3 - 5.5km     │
├─────────────────────┤
│ [+ More Routes]     │
└─────────────────────┘
```

---

## Component Architecture

```
RouteResultsPage/
├── MapLibreMap.jsx           # Full-page MapLibre GL map
│   ├── RouteLayer            # GeoJSON route polylines
│   ├── TransitRouteLayer     # Public transport route to start
│   ├── HomeMarker            # Animated home pin
│   └── StopMarkers           # Transit stop markers
├── RouteCardStack.jsx        # Floating cards (desktop right side)
│   └── RouteCardMini.jsx     # Compact route summary
├── RouteDetailPanel.jsx      # Slide-out panel with full details
│   ├── TransitToStart.jsx    # How to get to start point
│   ├── RouteStats.jsx        # Distance, time, calories, etc.
│   ├── ElevationProfile.jsx  # Recharts elevation chart
│   ├── RouteEditor.jsx       # (Future) Edit waypoints
│   └── ActionButtons.jsx     # GPX download, share, etc.
└── MobileBottomSheet.jsx     # Draggable sheet for mobile
```

---

## MapLibre Implementation

### Tile Provider: OpenFreeMap (Free, No API Key)

**Decision:** Use OpenFreeMap with a minimalist/positron style.

| Style | Description | URL |
|-------|-------------|-----|
| **Positron** | Clean, minimalist, light gray | `https://tiles.openfreemap.org/styles/positron` |
| **Bright** | Colorful OSM style | `https://tiles.openfreemap.org/styles/bright` |
| **Liberty** | Balanced OSM style | `https://tiles.openfreemap.org/styles/liberty` |

**Selected:** Positron (light) + Dark Matter (dark) with theme toggle

### Dark Mode Toggle

- Toggle button in header (☀️/🌙 icon)
- Switches between Positron (light) and Dark Matter (dark) tile styles
- Preference saved to localStorage
- Route colors adjust for contrast on each theme

### Map Features

- **Vector tiles** for crisp rendering at all zoom levels
- **Smooth animations** when focusing on routes
- **3D buildings** extruded from OpenStreetMap data (where available)
- **Terrain/hillshade layer** for topographical visualization
- **Route highlighting** with glow effect on hover/select
- **Directional flow animation** on selected route (subtle animated dashes)

### 3D Buildings Implementation

```javascript
// Add 3D building extrusions from OSM data
map.addLayer({
  'id': '3d-buildings',
  'source': 'openmaptiles',
  'source-layer': 'building',
  'type': 'fill-extrusion',
  'minzoom': 14,
  'paint': {
    'fill-extrusion-color': '#aaa',
    'fill-extrusion-height': ['get', 'height'],
    'fill-extrusion-base': ['get', 'min_height'],
    'fill-extrusion-opacity': 0.6
  }
});
```

### Terrain/Hillshade Layer

```javascript
// Add terrain source for topographical visualization
map.addSource('terrain', {
  type: 'raster-dem',
  url: 'https://tiles.openfreemap.org/terrain'  // or MapTiler terrain
});

map.addLayer({
  'id': 'hillshade',
  'type': 'hillshade',
  'source': 'terrain',
  'paint': {
    'hillshade-shadow-color': '#473B24',
    'hillshade-illumination-anchor': 'viewport'
  }
}, 'water');  // Insert below water layer
```

### Directional Route Animation

The selected route will have a subtle animated dash pattern that flows in the direction of travel (from transit stop → home).

```javascript
// Animated dash pattern showing direction
const dashArraySequence = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0]
];

// Animate through dash patterns
let step = 0;
function animateDashArray(timestamp) {
  const newStep = Math.floor((timestamp / 50) % dashArraySequence.length);
  if (newStep !== step) {
    map.setPaintProperty('selected-route', 'line-dasharray', dashArraySequence[newStep]);
    step = newStep;
  }
  requestAnimationFrame(animateDashArray);
}
```

**Visual effect:** Small dashes appear to "flow" along the route toward home, giving a subtle sense of direction without being distracting.

---

## Route Card Design

### Mini Card (Floating on Map)

```
┌────────────────────────┐
│ 🔵 Alexanderplatz      │  ← Color dot + station name
│    5.2 km              │  ← Distance only
└────────────────────────┘
```

- **Minimal design** - just station name + distance
- Hover: Highlight route on map
- Click: Open detail panel, zoom to route
- Color dot matches route polyline on map

### Detail Panel Content

```
┌─────────────────────────────────────┐
│  ✕                        ☀️/🌙    │  ← Close + theme toggle
│                                     │
│  🚂 Alexanderplatz                  │  ← Header
│  S3 · Platform 2 · 14:32            │  ← Transit info
│                                     │
├─────────────────────────────────────┤
│                                     │
│  🚇 Getting There (12 min)          │  ← Section: Transit to start
│  ┌─────────────────────────────┐   │
│  │ 🏠 Home                      │   │
│  │  ↓ Walk 3 min               │   │
│  │ 🚇 U Moritzplatz             │   │
│  │  ↓ U8 → Alexanderplatz (8m) │   │
│  │ 🚂 S Alexanderplatz          │   │  ← Arrival at start
│  └─────────────────────────────┘   │
│  Depart by: 14:20 to catch train   │  ← Leave-by time
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ⚙️ Your Pace: [5:30] min/km  ▼    │  ← User pace input
│                                     │
├─────────────────────────────────────┤
│                                     │
│  📊 Route Statistics                │
│  ┌─────────────────────────────┐   │
│  │ 🏃 5.2 km    │ ⏱️ 28:36     │   │  ← Distance + Duration
│  ├──────────────┼──────────────┤   │
│  │ ↑ 45 m       │ ↓ 62 m       │   │  ← Elevation gain/loss
│  ├──────────────┼──────────────┤   │
│  │ 🔥 ~312 kcal │ 🏁 15:01     │   │  ← Calories + ETA
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  📈 Elevation Profile               │
│  ┌─────────────────────────────┐   │
│  │      ╱╲                     │   │
│  │     ╱  ╲    ╱╲              │   │
│  │    ╱    ╲  ╱  ╲___          │   │
│  │   ╱      ╲╱                 │   │
│  └─────────────────────────────┘   │
│  [Distance ◉] [Time ○]    ← Toggle │  ← X-axis toggle
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ℹ️ Additional Info                 │
│  • Surface: 60% asphalt, 40% trail │
│  • Lighting: Partially lit          │
│  • Water: 2 fountains along route  │
│  • Busy areas: Tiergarten (peak)   │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ✏️ Edit Route               (Soon) │  ← Future feature
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [    📥 Download GPX    ]          │
│  [    🔗 Share Route     ]  (Soon)  │
│                                     │
└─────────────────────────────────────┘
```

#### 1. Header
- Station name with transit icon
- Transit line, platform, departure time
- Close button (X)
- Theme toggle (☀️/🌙)

#### 2. Getting There (Transit to Start)
- Step-by-step directions from home to the starting station
- Uses Deutsche Bahn / local transit API
- Shows walking segments + transit legs
- **Leave-by time** calculated: `departure_time - transit_duration - buffer`
- Toggle to show/hide this route on map (dashed line)

#### 3. Pace Settings
- User-adjustable pace input (min/km or min/mi)
- Dropdown or stepper control
- Saved to localStorage for future sessions
- Default: 5:30 min/km (running) or 3:00 min/km (cycling)

#### 4. Route Statistics Grid
| Stat | Calculation | Icon |
|------|-------------|------|
| **Distance** | Route length | 🏃 |
| **Duration** | Distance × Pace | ⏱️ |
| **Elevation Gain** | Sum of uphill segments | ↑ |
| **Elevation Loss** | Sum of downhill segments | ↓ |
| **Calories** | Distance × weight factor × terrain factor | 🔥 |
| **ETA** | Departure time + transit + duration | 🏁 |

**Calorie Formula:**
```
base_cal = distance_km × 60  // ~60 kcal/km running
terrain_factor = 1 + (elevation_gain / 100) × 0.1  // +10% per 100m climb
calories = base_cal × terrain_factor
```

#### 5. Elevation Profile
- Interactive Recharts chart
- Hover syncs marker on map
- **X-axis toggle:** Distance (km) ↔ Time (based on pace)
- Y-axis: Elevation (m)

#### 6. Additional Info (Nice-to-Have)
Helpful running context pulled from OpenStreetMap/Overpass:

| Info | Source | Why Useful |
|------|--------|------------|
| **Surface type** | OSM `surface` tag | Know if road/trail/cobblestone |
| **Lighting** | OSM `lit` tag | Important for evening runs |
| **Water fountains** | OSM `amenity=drinking_water` | Hydration on longer routes |
| **Busy areas/parks** | OSM analysis | Expect crowds at peak times |
| **Steep sections** | Elevation data | Warning for >10% grade |
| **Weather** | Weather API (future) | Temperature, rain, wind |

#### 7. Edit Route (Future - Placeholder)
- Disabled button with "Coming Soon" badge
- Future: Drag waypoints to adjust route
- Future: Add/remove via points
- Future: Avoid specific streets

#### 8. Actions
- **Download GPX** - Export route with elevation data
- **Share Route** (Future) - Copy link or share to social

## Interaction Patterns

| Action | Result |
|--------|--------|
| Hover route card | Highlight route on map (thicker, glow) |
| Click route card | Open detail panel, zoom to route, dim other routes |
| Click map route | Select that route, open detail panel |
| Hover elevation chart | Show marker on map at that position |
| Close detail panel | Deselect route, show all routes equally |
| Drag map | Free pan/zoom |
| Click "More Routes" | Fetch more, animate new routes appearing |

---

## Animation Specifications

| Element | Animation | Details |
|---------|-----------|---------|
| **Route direction** | Animated dashes flowing toward home | Subtle, continuous, ~20fps |
| Route selected | Scale up width, add glow (0.3s) | Other routes dim to 40% opacity |
| Detail panel | Slide in from right (0.3s ease-out) | Backdrop slightly dims map |
| Mobile sheet | Spring physics drag | Snaps to peek/half/full positions |
| Map transition | Fly-to selected route (1s) | Smooth camera with pitch/bearing |
| Hover route card | Route pulses once | Quick attention grab |

### Direction Animation Details

- Dashes flow **from transit stop → home** (direction you'll be running)
- Animation is **subtle** - dashes are small (2-3px) with 50ms frame intervals
- Only animates on **selected/hovered route** to avoid visual noise
- Uses `requestAnimationFrame` for smooth 60fps performance
- Falls back to static dashes on low-power devices

---

## Technical Considerations

### Dependencies to Add
```json
{
  "maplibre-gl": "^4.0.0",
  "react-map-gl": "^7.1.0"
}
```

### Dependencies to Remove
```json
{
  "leaflet": "remove",
  "react-leaflet": "remove"
}
```

### Performance
- Lazy load MapLibre (it's ~200KB gzipped)
- Use `useMemo` for GeoJSON route data
- Debounce hover interactions
- Virtual scroll for many routes (if > 10)

---

## Open Questions

1. ~~**Tile provider**: OpenFreeMap vs getting Stadia/Maptiler API key?~~ → **Decided: OpenFreeMap (Positron style)**
2. ~~**Mobile bottom sheet**: Use library (react-spring-bottom-sheet) or custom?~~ → **Use library for polish**
3. ~~**Route animations**: Worth the complexity or simple is better?~~ → **Decided: Subtle directional flow animation**
4. ~~**Dark/light mode**: Support light map style too?~~ → **Decided: Yes - toggle in header**
5. ~~**3D terrain**: Add visual interest or keep flat for clarity?~~ → **Decided: Yes - 3D buildings + hillshade**

## Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Card position | Right side | User preference, natural LTR reading |
| Tile provider | OpenFreeMap (free) | No API key needed, good enough quality |
| Map style | Positron (minimalist) + Dark Matter | Clean, with dark mode toggle |
| 3D features | Buildings + hillshade | Adds depth, shows terrain for running |
| Route animation | Directional dashes | Subtle indicator of travel direction |
| Mobile UX | Draggable bottom sheet | Modern pattern, space efficient |
| Dark mode | Toggle in detail panel header | Easy access while viewing route |
| Mini card content | Station name + distance only | Minimal, click for details |
| Transit to start | Show in detail panel | Critical for planning when to leave |
| Edit route | Placeholder for future | Keep UI clean, add later |
| GPX download | In detail panel | Logical place after reviewing route |

---

## Implementation Phases

### Phase 1: MapLibre Migration
- [ ] Install maplibre-gl and react-map-gl
- [ ] Create new MapLibreMap component
- [ ] Port markers and route polylines
- [ ] Remove Leaflet dependencies
- [ ] Test all existing functionality

### Phase 2: Layout Restructure
- [ ] Full-page map container
- [ ] Floating RouteCardStack component
- [ ] Basic route selection/highlighting
- [ ] Responsive breakpoints

### Phase 3: Detail Panel - Core
- [ ] Slide-out panel component
- [ ] Pace settings with localStorage
- [ ] Route statistics grid (distance, duration, elevation, calories, ETA)
- [ ] Move ElevationProfile into panel with distance/time toggle
- [ ] GPX download button

### Phase 4: Detail Panel - Transit Directions
- [ ] "Getting There" section
- [ ] Fetch transit route from home → start station
- [ ] Calculate "leave by" time
- [ ] Show transit route on map (dashed line, toggleable)

### Phase 5: Mobile Experience
- [ ] Bottom sheet component
- [ ] Touch-friendly interactions
- [ ] Proper viewport handling

### Phase 6: Polish
- [x] Animations and transitions (started: route selection transitions and card scale)
- [ ] Loading states
- [ ] Error handling
- [ ] Accessibility (keyboard nav, screen readers)
- [ ] Dark mode toggle

### Phase 7: Additional Info (Nice-to-Have)
- [ ] Surface type from OSM
- [ ] Lighting info
- [ ] Water fountains along route
- [ ] Steep section warnings

### Phase 8: Edit Route (Future Session)
- [ ] Placeholder UI with "Coming Soon"
- [ ] (Later) Draggable waypoints
- [ ] (Later) Via-point adding
- [ ] (Later) Route recalculation

---

## Feedback Requested

Please review and provide feedback on:

1. Does the overall layout direction work for your use case?
2. Any features missing from the detail panel?
3. Preference on tile provider?
4. Mobile bottom sheet - drag or tap to expand?
5. Any other interactions you'd like to see?
