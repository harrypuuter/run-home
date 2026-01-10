# E2E Testing Guide

This file documents the deterministic E2E testing approach used by the Run-Home project.

## Key points

- Tests no longer rely on live Overpass / OSRM / Open‑Meteo endpoints to avoid rate limits and flakiness.
- A shared fixture helper, `tests/e2e/fixtures/api-mocks.js`, sets up deterministic responses for:
  - Overpass API (`**/api/interpreter*`)
  - OSRM routing (`**/route/v1/**` and `**/routed-*/route/**`)
  - Open‑Meteo elevation (`https://api.open-meteo.com/v1/elevation*`)

## How it works

- Call `setupApiMocks(page)` near the top of your test before navigating to `/run-home/debug`. This sets up route handlers and returns deterministic JSON responses for stations, routes, and elevation data.

Example:

```js
import { setupApiMocks } from './fixtures/api-mocks.js'

// in test
await setupApiMocks(page)
await page.goto('/run-home/debug')
await page.getByRole('button', { name: /Start Debug Session/i }).click()
```

## Why this matters

- CI stability: avoids transient failures caused by external rate limits and outages.
- Faster tests: mocking avoids potentially slow network calls.
- Deterministic assertions: responses are stable across runs and environments.

## Notes & Follow-ups

- Visual regression tests for the elevation profile should be added when a stable capture flow is available (e.g. run locally or only in a debug-only job). We currently convert visual checks into fast smoke tests to keep CI fast and stable.
- If you need to update fixtures to match upstream changes, edit `tests/e2e/fixtures/api-mocks.js` and add a short test demonstrating the new behavior.
