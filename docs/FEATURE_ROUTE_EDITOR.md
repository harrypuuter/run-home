# Feature: Route Editor (Archived)

Status: Moved to `docs/finished/FEATURE_ROUTE_EDITOR.md` (Implemented Jan 10, 2026)

This document has been archived and a short implemented-notes copy lives in `docs/finished/FEATURE_ROUTE_EDITOR.md`.
Summary
-------
Provide an inline Route Editor to let users customize suggested routes by adding, moving and removing waypoints. Changes are previewed in real-time (tentative routing & metrics update) while editing, and applied only when the user presses Save.

Goals
-----
- Allow users to add custom waypoints by clicking on the map or dragging on the map.
- Allow users to reposition waypoints by dragging markers.
- Removal of waypoints only via the side-panel list (Start and End are fixed and cannot be removed).
- Update distance, duration and elevation metrics live as the tentative route changes.
- Keep changes in-memory (no server persistence for MVP).

Decisions (confirmed)
---------------------
- Waypoint insertion: insert at nearest route segment to preserve route continuity (Option A).
- Maximum waypoints: 6 (to limit routing cost and UI complexity).
- Persistence: in-memory only for MVP (no localStorage or server persistence).

Architecture & Data Flow
------------------------
- Edit snapshot: while editing, store an in-memory snapshot on the parent component (RouteResults or RouteDetailPanel):
  {
    originalRoute: {...},       // reference to pre-edit route geometry and metrics
    waypoints: [{lat,lng}, ...], // ordered user waypoints (excludes start/end)
    tentativeRoute: {...},       // GeoJSON/OSRM response for preview
    tentativeMetrics: {...},     // {distance, duration, elevationSummary}
  }

- Map interactions (active only while editMode === true):
  - onMapClick: compute insertion index (nearest segment) and insert waypoint into `waypoints`; request tentative route from OSRM.
  - onMapDragEnd (new point): when dragging on empty map, create a new waypoint at drop point and insert at nearest segment.
  - onMarkerDrag: update the waypoint coords and debounce OSRM requests (200ms) to avoid excessive calls; the final drop triggers a full request.

- Routing & elevation:
  - Use the existing OSRM wrapper (`src/services/osrm.js`) to compute route geometry for [start, ...waypoints, end].
  - When a tentative route geometry is available, update `tentativeMetrics.distance` from OSRM route.distance and then call Open‑Meteo elevation sampling for the new geometry (batched sampling with caching). Update the ElevationProfile component with new points.

- Save/Cancel:
  - Save: replace the selected route's geometry, metrics and any relevant cached elevation data with the `tentative` values and close edit mode.
  - Cancel: discard snapshot and revert to original route geometry/metrics.

Accessibility
-------------
- Markers are keyboard-focusable (tab index), Enter toggles 'move' mode, Arrow keys nudge (small deltas), Escape cancels move.
- Editor list is keyboard navigable; Remove has focusable button and accessible label.
- Announce changes via an aria-live region: "Waypoint added", "Waypoint removed", "Route saved".

Error Handling & Constraints
---------------------------
- Limit the number of waypoints to 6; when reached, show an inline message and disable further additions.
- If OSRM or elevation calls fail, show a non-blocking inline error and keep edit mode open so users can retry or cancel.

Testing Strategy
----------------
- Unit tests for insertion index computation, waypoint list mutations, and Save/Cancel behavior.
- E2E tests (using `tests/e2e/fixtures/api-mocks.js`) to cover:
  - Click-to-add waypoint → preview update → Save → route card metrics update
  - Drag-to-add waypoint → preview update
  - Drag existing waypoint → preview update and Save
  - Remove waypoint via side panel → preview update
  - Keyboard accessibility for markers and editor controls

Acceptance Criteria
------------------
- Users can enter edit mode, add up to 6 waypoints (via click and drag), reposition markers, remove waypoints via the list, and Save/Cancel edits.
- Distance and elevation profile update in preview and reflect after Save.
- Tests (unit + E2E) demonstrate the core flow.

Roadmap & Stages
----------------
See scoped tasks in `docs/TODO.md` and the project's TODO list for incremental work.

Notes
-----
- This MVP purposely keeps changes in-memory to reduce complexity and iteration time. If desired, we can add localStorage persistence or server-side save as a follow-up.
- Snapping-to-road and undo/redo are deferred to phase 2.

Manual testing
--------------
1. Start the dev server: `npm run dev` (Vite). If port 5173 is unavailable, check the printed local URL (e.g., `http://localhost:5174/run-home/`).
2. Open the Debug page: `/run-home/debug` (e.g., `http://localhost:5174/run-home/debug`).
3. Click **Start Debug Session**.
4. Select the first route (click the route card or call `window.__runhome_selectRoute(0)` in the console).
5. Wait until the Route Details panel appears and the **Download GPX** button is visible.
6. Click **Edit** to enter edit mode. A small yellow overlay will appear indicating edit mode.
7. Click on the map to add a waypoint. A marker should appear and the side-panel list should show `Waypoint 1`.
8. Drag the waypoint marker to reposition it; after a short debounce the tentative route and elevation profile should update.
9. Remove a waypoint using the **Remove** button in the side-panel list.
10. Click **Save** to commit changes (the main route preview updates). Use **Cancel** to discard edits.

Tips
----
- Use `window.__runhome_addWaypointCurrent({ lat, lng })` and `window.__runhome_toggleEditCurrent()` from the browser console to exercise helpers during manual tuning.
- When tuning visual polish, adjust marker and overlay styles in `src/components/MapLibreMap.jsx` and `src/components/RouteEditor.jsx`.
