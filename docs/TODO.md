# Run-Home App - TODO List

> **Last Updated:** January 10, 2026
> **Priority:** 🔴 High | 🟡 Medium | 🟢 Low

---

## ✅ Completed

Completed items are documented in `docs/CHANGELOG.md` — see the Unreleased and versioned entries for details.

---

## 🔴 High Priority - Next Session

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
