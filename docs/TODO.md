# Run-Home App - TODO List

> **Last Updated:** January 8, 2026
> **Priority:** 🔴 High | 🟡 Medium | 🟢 Low

---

## ✅ Completed

### Bugs Fixed

- [x] **Fix routing setting** - Switched to OSRM.de servers with proper foot/bike profiles
- [x] **Fix Elevation Profile ↔ Map Hover Sync** - Fixed type checking, added proper pane/key props
- [x] **Fix excessive re-renders** - Added useCallback, useMemo, memo, fixed useEffect dependencies
- [x] **Fix routes disappearing** - Fixed useEffect race condition with isCalculatingRef
- [x] **Fix elevation API reliability** - Switched from Open-Elevation (unreliable) to Open-Meteo (stable)

### Features Implemented

- [x] **Deutsche Bahn API integration** - Real transit data for Germany
- [x] **Departure time selection** - Date/time picker with quick-select buttons
- [x] **Improved elevation data** - Using Open-Meteo API (free, reliable)
- [x] **GPX export with elevation** - Elevation data included in GPX files
- [x] **Direct route mode** - Fallback when DB API unavailable (generates waypoints by direction)
- [x] **API availability check** - Background check on startup with graceful degradation

---

## 🔴 High Priority - Next Up

### 1. MapLibre Migration + Full-Page Map Layout
**Status:** Planned
**Spec:** See [FEATURE_MAPLIBRE_REDESIGN.md](./FEATURE_MAPLIBRE_REDESIGN.md)

**Summary:**
- Switch from React-Leaflet to MapLibre GL JS
- Full-page map with floating route cards
- Slide-out detail panel with elevation profile
- 3D buildings and hillshade terrain
- Directional route animation
- Dark/light mode toggle

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
