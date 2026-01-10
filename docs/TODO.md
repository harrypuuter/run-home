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

## 📦 Phase 6 — MapLibre Redesign: Mobile & Polishing (in-progress)
The scope of Phase 6 is focused on mobile UX polish, route editing, and performance improvements for the MapLibre redesign. Below are proposed initial tasks; I can start implementing them immediately or adjust based on your priorities.

- [ ] Mobile UX polish: smooth interactions, bottom sheet inertia, ARIA/accessibility improvements
- [ ] Route editor skeleton: draggable via-points on map, UI for adding/removing points
- [ ] Performance: lazy-load heavy components, throttle expensive map updates, virtualize long lists
- [ ] Transit overlay improvements: dashed + glow styles, selective opacity and z-ordering
- [ ] Add cache eviction/TTL for elevation cache (LRU or time-based expiry)
- [ ] Visual regression tests: add a simple Playwright/Puppeteer capture for elevation profile to prevent regressions

**Notes:**
- Marked as **in-progress** in the task tracker; I will start with the mobile UX polish (bottom sheet inertia and accessibility) unless you specify a different priority.


## 🟡 Medium Priority

### 2. Route Editing (Phase 2)
**Status:** MVP Complete, Phase 2 planned
**Description:** Advanced route editing features.

**Phase 2 Features:**
- [ ] Draggable waypoints on route (removed from MVP for simplicity)
- [ ] Waypoint snapping to roads/paths
- [ ] Undo/redo for edits
- [ ] Keyboard accessibility for markers

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

## 📦 Phase 7 — MapLibre Followups (planned)
Phase 7 continues the MapLibre redesign with accessibility, performance, and polishing tasks. The design has been implemented — see `docs/finished/FEATURE_MAPLIBRE_REDESIGN.md` for the archived spec and implementation notes.

- [ ] Accessibility audit & keyboard navigation for full-page map and bottom sheet
- [ ] Performance profiling: lazy-load non-critical layers, debounce expensive updates
- [ ] Reintroduce route animation behind a user setting (accessibility opt-in) — consider: subtle flowing lines, feature flag, and reduced-motion preference
- [x] Visual polish: route dash animation, glow tuning, and 3D building toggles (done: animated direction indicator on selected route)
- [ ] Route editor improvements: waypoint snapping and undo/redo
- [x] Add deterministic E2E test fixtures for core services (Overpass/OSRM/Open‑Meteo) to avoid CI flakes (done: `tests/e2e/fixtures/api-mocks.js`)

### Route Editor ✅ (MVP Complete)
The Route Editor design has been implemented — see the archived spec and notes in `docs/finished/FEATURE_ROUTE_EDITOR.md`. 

(Keep the original `docs/FEATURE_ROUTE_EDITOR.md` for historical reference.)

**Completed MVP:**
- [x] Click-to-add waypoints (insert at nearest route segment)
- [x] Manual "Update Route" button with pulse animation on changes
- [x] Tentative routing & metrics update (distance, duration, calories)
- [x] Elevation profile refresh after route update (fixed: uses route hash for dependency)
- [x] Waypoint markers on elevation profile (vertical dashed lines with labels)
- [x] Distance from previous point shown in waypoint list
- [x] Directional animation on selected route (station → home direction indicator)
- [x] Save/Cancel buttons integrated into panel footer
- [x] Side-panel waypoint removal with numbered labels
- [x] Enforce max waypoints = 6 with inline messaging
- [x] Edit mode indicator on map
- [x] Integrated edit mode into RouteDetailPanel with conditional UI

**Deferred (Phase 2):**
- [ ] Draggable waypoint markers (removed for simplicity)
- [ ] Map drag-to-create waypoint
- [ ] Waypoint snapping and undo/redo
- [ ] Accessibility: keyboard interactions for markers and editor controls
- [ ] Add E2E interaction tests (click-add, remove)
- [ ] Performance improvements & limit checks (debounce, caching, TTL for elevation cache)

**Follow-ups:**
- [ ] Convert any remaining visual regressions into fast smoke tests where appropriate
- [ ] Add a small visual check for elevation smoothing once we can capture a stable image via `DebugMapLibre` or a local-run-only screenshot test

**Notes:**
- Phase 7 ties closely to the MapLibre redesign doc; when ready, create E2E tests using `DebugMapLibre` for deterministic cases.
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
