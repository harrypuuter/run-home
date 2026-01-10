# Feature Spec: MapLibre Migration + Full-Page Map Layout

> **Status:** Implemented (January 10, 2026)
> **Originally Created:** January 8, 2026
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

The selected route will have a subtle animated dash pattern that flows in the direction of travel (from transit st
op → home).
```javascript
// Animated dash pattern showing direction
const dashArraySequence = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],