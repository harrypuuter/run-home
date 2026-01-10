# Run-Home App - TODO List

> **Last Updated:** January 9, 2026
> **Priority:** 🔴 High | 🟡 Medium | 🟢 Low

---

## ✅ Completed

### MapLibre Migration (Phase 1-3)

- [x] **MapLibreMap component** - Full-page vector map with OpenFreeMap tiles
- [x] **RouteResults redesign** - Floating route cards with slide-out detail panel
- [x] **ElevationProfile redesign** - Canvas-based rendering with built-in stats
- [x] **Removed Leaflet dependency** - MapLibreMap now handles all route display
- [x] **OSM transit fallback** - Overpass API fallback when Deutsche Bahn API is down
- [x] **Open-Meteo elevation** - CORS-friendly elevation API (max 50 points per request)
- [x] **File cleanup** - Removed old *New.jsx files, renamed to default names
- [x] **Dark mode toggle removed** - Simplified UI
- [x] **Panel width 35%** - Improved layout

### Bugs Fixed

- [x] **Fix routing setting** - Switched to OSRM.de servers with proper foot/bike profiles
- [x] **Fix Elevation Profile ↔ Map Hover Sync** - Fixed type checking, added proper pane/key props
- [x] **Fix excessive re-renders** - Added useCallback, useMemo, memo, fixed useEffect dependencies
- [x] **Fix routes disappearing** - Fixed useEffect race condition with isCalculatingRef
- [x] **Fix elevation API reliability** - Switched from Open-Elevation (unreliable) to Open-Meteo (stable)
- [x] **Fix distance tolerance** - Increased to 30% for more route matches

### Features Implemented

- [x] **Deutsche Bahn API integration** - Real transit data for Germany
- [x] **Departure time selection** - Date/time picker with quick-select buttons
- [x] **Improved elevation data** - Using Open-Meteo API (free, reliable)
- [x] **GPX export with elevation** - Elevation data included in GPX files
- [x] **Direct route mode** - Fallback when DB API unavailable (generates waypoints by direction)
- [x] **API availability check** - Background check on startup with graceful degradation

---

## 🔴 High Priority - Next Session

### 1. Fix WebGL Context Loss
**Status:** In Progress
**Issue:** MapLibre repeatedly losing WebGL context during HMR and route calculation

**Symptoms:**
- `WebGL context was lost` errors in console
- `mapLoaded: false styleLoaded: false` prevents route display
- Routes calculate correctly but don't appear on map

**Attempted fixes:**
- [x] Added `preserveDrawingBuffer: true` to map options
- [x] Added WebGL context loss/restore event handlers
- [x] Added context validity check before route rendering
- [ ] May need to debounce route updates or delay map initialization

### 2. Verify Elevation Profile Display
**Status:** Done (manual verification)
**Update:** Elevation sampling now resamples routes into equally spaced points; elevation samples are cached and two-pass smoothing reduces stair-step artifacts from meter-quantized API results.

**Follow-ups:**
- [ ] Add cache eviction / TTL (LRU or time-based expiry) to avoid unbounded `localStorage` growth
- [ ] Add a visual regression test or screenshot-based QA for elevation smoothing to prevent regressions

**Debug logs to check:**
- `[ElevationProfile] Draw effect - canvas:` should show valid dimensions
- Check if elevation data is being fetched successfully (look for `[Elevation] Resampled to`, `[Elevation] Fetching batch`, and `[Elevation] Applied two-pass smoothing`)

---

## 🟡 Medium Priority

### 2. Route Editing
**Status:** Placeholder in redesign spec
**Description:** Allow users to modify routes by dragging waypoints.

**Features:**
- [ ] Draggable waypoints on route
- [ ] Add/remove via points
- [ ] Route recalculation
- [ ] Distance/elevation update after edit

---

### 3. Additional Route Info
**Status:** Planned (Phase 7 of redesign)
**Description:** Show helpful running context from OSM.

**Info to add:**
- [ ] Surface type (asphalt, trail, cobblestone)
- [ ] Lighting (for evening runs)
- [ ] Water fountains along route
- [ ] Steep section warnings (>10% grade)

---

## 🟢 Low Priority

### 4. Route Alternatives
**Status:** Not Started
**Description:** Show 2-3 alternative routes for the same start/end.
- [ ] Use OSRM `alternatives=true`
- [ ] Display as dashed lines
- [ ] Allow switching between alternatives

### 5. Save Favorite Routes
**Status:** Not Started
- [ ] Store routes in localStorage
- [ ] "My Routes" section
- [ ] Export/import saved routes

### 6. Share Route via Link
**Status:** Not Started
- [ ] Generate shareable URL
- [ ] Copy-to-clipboard button
- [ ] Handle incoming shared URLs

---

## 📋 Technical Debt

### Code Quality
- [ ] Add TypeScript types
- [ ] Add ESLint rules for hooks
- [ ] Add unit tests for services
- [ ] Add integration tests for wizard flow

### Documentation
- [x] Create CHANGELOG.md
- [x] Create TODO.md
- [x] Create FEATURE_MAPLIBRE_REDESIGN.md
- [x] Update DESIGN.md with current architecture
- [ ] Add JSDoc comments to services
- [ ] Create CONTRIBUTING.md

### Performance
- [ ] Lazy load RouteResults step
- [ ] Virtualize long route lists
- [ ] Preload elevation data

---

## 🗓️ Next Session Plan

1. **Implement MapLibre Migration** (Phase 1)
   - Install maplibre-gl and react-map-gl
   - Create new MapLibreMap component
   - Port markers and route polylines
   - Remove Leaflet dependencies

2. **Layout Restructure** (Phase 2)
   - Full-page map container
   - Floating RouteCardStack component
   - Basic route selection/highlighting
