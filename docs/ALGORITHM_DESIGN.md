# Run-Home Algorithm Design

> **Version:** 2.0 (Simplified)
> **Last Updated:** January 9, 2026
> **Status:** Draft - Pending Implementation

---

## Overview

This document defines the simplified algorithmic flow for the Run-Home app. The goal is to reduce complexity and eliminate duplications from the current implementation.

---

## User Inputs

The wizard collects the following inputs:

| Input | Type | Example |
|-------|------|---------|
| `homeLocation` | `{ lat, lng, displayName }` | `{ lat: 52.52, lng: 13.405, displayName: "Berlin" }` |
| `distance` | `number` (km) | `10` |
| `activity` | `'run' \| 'bike'` | `'run'` |
| `direction` | `'north' \| 'east' \| 'south' \| 'west' \| 'any'` | `'any'` |
| `departureTime` | `Date` | `2026-01-09T15:00:00` |

---

## Algorithm Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     1. COLLECT USER INPUTS                       │
│                        (Wizard Steps 1-5)                        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  2. FIND CANDIDATE START POINTS                  │
│                                                                  │
│  Query: OSM Overpass API                                         │
│  Search Area: Annulus around home                                │
│    - Inner radius: distance × 0.5 km                             │
│    - Outer radius: distance × 1.0 km                             │
│  Filter: By direction (if not 'any')                             │
│  Result: List of transit stations/POIs                           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. CALCULATE ROUTES                           │
│                                                                  │
│  For each candidate start point:                                 │
│    1. Call OSRM routing API (start → home)                       │
│    2. Check if route distance is within tolerance (±10% → ±30%) │
│    3. If valid, add to display list                              │
│    4. Stop after finding N valid routes (default: 5)             │
│                                                                  │
│  Parallel: Start fetching elevation for first valid route        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     4. DISPLAY RESULTS                           │
│                                                                  │
│  - Show routes on MapLibre map                                   │
│  - Display route cards with basic info                           │
│  - Routes are clickable to show details                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              5. ON ROUTE SELECTION (Detail Panel)                │
│                                                                  │
│  Parallel tasks:                                                 │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │ 5a. ELEVATION       │    │ 5b. TRANSIT (opt)   │             │
│  │                     │    │                     │             │
│  │ If not cached:      │    │ If DB API available:│             │
│  │ - Fetch from        │    │ - Query journey     │             │
│  │   Open-Meteo API    │    │   from home to      │             │
│  │ - Render profile    │    │   start point       │             │
│  │ - Cache result      │    │ - Show directions   │             │
│  │                     │    │                     │             │
│  │ If cached:          │    │ If unavailable:     │             │
│  │ - Use cached data   │    │ - Show nothing      │             │
│  │                     │    │ - No error message  │             │
│  └─────────────────────┘    └─────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Step Descriptions

### Step 2: Find Candidate Start Points

**Primary Method: OSM Overpass API**

```javascript
// Query structure
const query = `
  [out:json][timeout:25];
  (
    node["railway"="station"](around:${outerRadius},${lat},${lng});
    node["railway"="halt"](around:${outerRadius},${lat},${lng});
    node["public_transport"="station"](around:${outerRadius},${lat},${lng});
    node["railway"="tram_stop"](around:${outerRadius},${lat},${lng});
  );
  out body;
`

// Post-filter by distance (annulus)
candidates = results.filter(point => {
  const dist = haversineDistance(home, point)
  return dist >= innerRadius && dist <= outerRadius
})

// Filter by direction (if specified)
if (direction !== 'any') {
  candidates = candidates.filter(point => isInDirection(home, point, direction))
}
```

**Search Radius Calculation:**

| Target Distance | Inner Radius | Outer Radius |
|-----------------|--------------|--------------|
| 5 km | 2.5 km | 5 km |
| 10 km | 5 km | 10 km |
| 15 km | 7.5 km | 15 km |
| 20 km | 10 km | 20 km |

**Why annulus instead of circle?**
- Starting points too close to home produce very short routes
- Starting points at ~50-100% of target distance produce routes of the right length
- Reduces number of candidates to check

---

### Step 3: Calculate Routes

**OSRM API Call:**

```javascript
const route = await calculateRoute({
  startLat: candidate.lat,
  startLng: candidate.lng,
  endLat: home.lat,
  endLng: home.lng,
  profile: activity === 'run' ? 'foot' : 'bike',
})
```

**Distance Tolerance (Adaptive):**

Start with strict tolerance, relax if insufficient routes found:

| Pass | Tolerance | Example (10 km target) |
|------|-----------|------------------------|
| 1st | ±10% | 9 - 11 km |
| 2nd | ±20% | 8 - 12 km |
| 3rd | ±30% | 7 - 13 km |

```javascript
const TOLERANCE_PASSES = [0.10, 0.20, 0.30]

for (const tolerance of TOLERANCE_PASSES) {
  const min = distance * (1 - tolerance)
  const max = distance * (1 + tolerance)

  // Try to find routes within this tolerance
  const routes = await findRoutesInRange(candidates, min, max)

  if (routes.length >= TARGET_ROUTES) {
    return routes.slice(0, TARGET_ROUTES)
  }

  // Not enough routes, try next (looser) tolerance
  validRoutes.push(...routes)
}

return validRoutes.slice(0, TARGET_ROUTES)
```

**Route Selection Strategy:**

1. Sort candidates by distance from target (closest first)
2. Calculate routes until we have 5 valid ones
3. Start with ±10% tolerance, relax to ±20%, then ±30% if needed
4. Maximum attempts: 30 candidates per pass
5. Rate limit: 150ms between API calls

---

### Step 5a: Elevation Profile

**API: Open-Meteo Elevation API**

- Free tier, no API key needed
- Limit: 50 points per request
- Sample route coordinates to stay under limit

```javascript
// Sample coordinates (max 50 points)
const sampled = sampleCoordinates(route.geometry.coordinates, 50)

// Fetch elevations
const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
```

**Caching:**
- Cache elevation data by route ID
- Reuse when switching between routes

---

### Step 5b: Transit Directions (Optional)

**Only if Deutsche Bahn API is available:**

```javascript
if (dbApiAvailable) {
  const journey = await findJourneys({
    from: home,
    to: startPoint,
    departure: departureTime,
  })
  // Display in detail panel
}
// If unavailable: silently skip, no error shown
```

---

## Data Flow Diagram

```
User Inputs
     │
     ▼
┌─────────────┐    ┌─────────────┐
│   Wizard    │───▶│   State     │
│  Component  │    │  (React)    │
└─────────────┘    └──────┬──────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ RouteResults  │
                  │   Component   │
                  └───────┬───────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │    OSM    │   │   OSRM    │   │ Open-Meteo│
    │  Overpass │   │  Routing  │   │ Elevation │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          └───────────────┴───────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  MapLibreMap  │
                  │  + UI Cards   │
                  └───────────────┘
```

---

## API Dependencies

| API | Purpose | Required | Fallback |
|-----|---------|----------|----------|
| **OSM Overpass** | Find start points | Yes | None (app fails gracefully) |
| **OSRM** | Calculate routes | Yes | None |
| **Open-Meteo** | Elevation data | Yes | Flat profile |
| **Deutsche Bahn** | Transit directions | No | Skip silently |

---

## Current vs. Proposed Implementation

### Current Issues:

1. **Dual API for start points**: Tries DB API first, then OSM. Redundant.
2. **generateDirectRouteWaypoints**: Creates fake waypoints when APIs fail. Over-engineered.
3. **Transit fetched during route calculation**: Adds latency to main flow.
4. **Complex state management**: Multiple refs tracking calculation state.

### Proposed Simplifications:

1. **Single API for start points**: OSM Overpass only (more reliable, no API key)
2. **Remove waypoint generation**: If no stations found, show "no routes" message
3. **Defer transit to selection**: Only fetch when user clicks a route
4. **Cleaner state**: Single source of truth for routes

---

## Implementation Checklist

- [x] Refactor `RouteResults.jsx` to use simplified flow
- [x] Create `findStartPoints()` function using OSM only
- [x] Implement annulus filtering (inner/outer radius)
- [x] Move transit lookup to detail panel (lazy load)
- [x] Remove `generateDirectRouteWaypoints()` function
- [x] Remove Deutsche Bahn dependency for start point discovery
- [x] Implement adaptive tolerance (10% → 20% → 30%)
- [x] Update to 5 routes target
- [ ] Add proper caching for elevation data
- [ ] Update tests

---

## Open Questions

1. ~~Should we support non-transit start points (parks, landmarks)?~~ → **Deferred to later edition**
2. ~~Maximum number of routes to display?~~ → **5 routes**
3. Should "More Routes" fetch more or re-shuffle?

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-09 | 2.0 | Simplified algorithm design |
| 2026-01-09 | 2.1 | Implemented simplified algorithm |
