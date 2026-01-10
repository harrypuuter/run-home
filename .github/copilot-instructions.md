# Copilot / AI Agent Instructions for Run Home

Purpose: give an AI coding agent the minimal, high-value knowledge to be productive in this repository.

Guiding principles
- Keep changes minimal, obvious, and well-tested: this is a small UI-heavy app with a fragile algorithmic pipeline for route discovery. Prefer small, incremental changes with a visible debug flow and E2E tests.
- Preserve fallback behaviour: many services have fallbacks (OSM/Overpass when DB API is unavailable). Don't remove fallbacks without providing a robust replacement and tests.

Big picture (what to know first)
- React + Vite single-page app. The core UX is a wizard (see `src/components/Wizard.jsx`) that builds a `state` object and passes it into steps in `src/components/steps/`.
- Route discovery algorithm lives in `src/components/steps/RouteResults.jsx`.
  - Step 1: find candidate transit stations via Overpass (`src/services/nominatim.js` -> `fetchOSMTransitStations`)
  - Step 2: compute walking/running/cycling route distances via OSRM (`src/services/osrm.js` -> `calculateRoute` / `calculateRoutesForStops`)
  - Step 3: lazy-load transit journeys from DB API (`src/services/deutschebahn.js` -> `findJourneys`) if the DB API is available.
- Maps: two implementations exist
  - `src/components/Map.jsx` (Leaflet, uses lat,lng arrays [lat, lng])
  - `src/components/MapLibreMap.jsx` (MapLibre, uses GeoJSON/lng,lat internally; be careful when converting coordinate order)
  - GeoJSON route geometries use standard `[lng, lat]` pairs; many helper functions convert to Leaflet's `[lat, lng]` when needed.

Important project-specific conventions
- Coordinate order traps: MapLibre/OSRM/GeoJSON use [lng,lat] whereas Leaflet components and many internal UI props expect [lat,lng]. Look for comments in `MapLibreMap.jsx` and `Map.jsx` when changing coordinates.
- Normalized service return shapes:
  - Stop: `{ id, name, lat, lng, type, distance, products }` (see `src/services/deutschebahn.js` / `src/services/nominatim.js`)
  - OSRM route: `{ distance, duration, geometry }` where `geometry` is a GeoJSON LineString
- Limits & polite usage:
  - Deutsche Bahn API has rate limits and fallback endpoints; code uses short timeouts and endpoint rotation (`src/services/deutschebahn.js`). Use `checkApiAvailability()` to detect availability.
  - OSRM batch calls include small delays (100ms) to avoid rate limiting (`calculateRoutesForStops`). Keep or adjust delays thoughtfully and test core flows.
- Nominatim: requires a valid `User-Agent` header and is restricted to Germany. The code sets `User-Agent: RunHomeApp/1.0` (see `src/services/nominatim.js`).

Testing & workflows
- Local dev server: `npm install` then `npm run dev` (Vite; default: http://localhost:5173).
- Build: `npm run build` and `npm run preview` to check the production build.
- Lint: `npm run lint`.
- E2E: Playwright tests live under `tests/e2e/`. Use the debug page to craft deterministic scenarios: `http://localhost:5173/run-home/debug` (see `src/pages/DebugMapLibre.jsx`) — tests often use this page to bypass the wizard.
  - Run tests locally: `npx playwright install --with-deps` then `npm run test:e2e` (or `npx playwright test`). CI uses Node 20; prefer Node 20 when running the Playwright job locally.

What good tests look like here
- E2E tests that exercise the debug page for deterministic behavior (see `tests/e2e/bottom-sheet.spec.js`).
- When changing the algorithm (RouteResults): add an E2E test that uses `DebugMapLibre` to verify at least one successful route is produced for a known test location.
- For map rendering changes, include visual stability checks where possible (e.g., assert presence of DOM elements, popups, tooltips), not pixel-perfect screenshots unless necessary.

Files & places to look for context
- Algorithm & UI: `src/components/steps/RouteResults.jsx`
- Map implementations: `src/components/Map.jsx` (Leaflet), `src/components/MapLibreMap.jsx` (MapLibre)
- Services: `src/services/deutschebahn.js`, `src/services/nominatim.js`, `src/services/osrm.js`, `src/services/elevation.js`, `src/services/gpx.js`
- Debug helpers: `src/pages/DebugMapLibre.jsx` (good for deterministic E2E test cases)
- Tests: `tests/e2e/` (Playwright)
- CI for Playwright: `.github/workflows/e2e.yml` (shows Node 20 and that Playwright browsers must be installed)

Practical examples (copyable patterns)
- Check DB API availability before fetching transit: `if (!await checkApiAvailability()) { /* use OSM fallback */ }`
- Convert GeoJSON coordinates to Leaflet points: `route.geometry.coordinates.map(([lng,lat]) => [lat, lng])`
- Add a small delay between OSRM requests to avoid hitting rate limits: `await new Promise(r => setTimeout(r, 100))` (this is already used in `calculateRoutesForStops`)

Design & docs highlights (from `docs/`):
- Annulus search: inner/outer radii are derived from target distance (inner ≈ 0.5×distance, outer ≈ 1.0×distance). See `docs/ALGORITHM_DESIGN.md` and `src/services/nominatim.js`.
- Adaptive tolerance: the algorithm relaxes distance tolerance across passes (example: ±10% → ±20% → ±30%) until it finds `ROUTES_TARGET` (default 5). Key constants live in `src/components/steps/RouteResults.jsx` (`ROUTES_TARGET`, `MAX_CANDIDATES_PER_PASS`, `API_DELAY_MS`).
- Elevation: Open-Meteo is used for elevation (limit ≈ 50 points per request); elevation data is cached per-route where practical (`src/services/elevation.js`). Keep sampling to ≤50 points when fetching.
- Transit lookup: Deutsche Bahn journeys are fetched lazily when a route is selected; if the API is unavailable the app skips transit silently (no user error). Use `checkApiAvailability()` to respect availability.
- State & persistence: Home location is saved to `localStorage`; pace and some user preferences are also persisted (see `docs/DESIGN.md`).
- MapLibre specifics: MapLibre uses OpenFreeMap tiles (Positron/Liberty URLs in `src/components/MapLibreMap.jsx`); dark/light styles are toggled and saved to `localStorage`. MapLibre uses `[lng, lat]` ordering, while Leaflet expects `[lat, lng]` — be careful when converting coordinates. MapLibre code handles WebGL context loss and uses `preserveDrawingBuffer` to support exports/screenshots.
- Visual & UX notes: `docs/FEATURE_MAPLIBRE_REDESIGN.md` includes design snippets for 3D buildings, hillshade/terrain sources, and directional dash animations (useful reference when modifying the map UI).
- Testing note: Use `src/pages/DebugMapLibre.jsx` for deterministic E2E tests — it preconfigures locations and intentionally disables DB API (`dbApiAvailable={false}`) to ensure stable tests (see `tests/e2e/` examples).
- Error handling expectations: Follow the app's strategy (no blocking errors for optional services, retry or provide helpful messages for timeouts/rate-limits). See `docs/DESIGN.md` for example user-facing messages.

Editor / PR expectations
- Keep changes small and scope-limited. Add or update Playwright E2E tests when behavior observable by users changes.
- Use the debug page for fast iteration and tests; it is designed for deterministic scenario setups.

If anything above is unclear or you want the agent to expand any section (examples, more file references, or add template tests), tell me which parts and I’ll refine the doc.