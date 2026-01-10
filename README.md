# Run Home 🏃‍♂️🏠 🇩🇪

[![E2E Tests](https://github.com/harrypuuter/run-home/actions/workflows/e2e.yml/badge.svg)](https://github.com/harrypuuter/run-home/actions/workflows/e2e.yml)

> CI runs Playwright E2E tests on PRs and pushes — enable the workflow as a required status check in repository settings to block merging on failures.


A web application that helps runners and cyclists in **Germany** plan their journey home from public transit stops using Deutsche Bahn data.

## Features

- 📍 Set your home location via map or search (Germany only)
- 📏 Choose your desired distance (2-150 km)
- 🏃‍♂️ Select activity type (Run or Bike)
- � Pick your departure time for transit connections
- 🧭 Choose direction (N, E, S, W, or Any)
- 🗺️ View routes on an interactive map
- 🚆 See detailed transit info (train numbers, platforms, delays)
- 📊 Elevation profile for each route
- 📥 Download routes as GPX files

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Leaflet** - Maps
- **Recharts** - Elevation charts
- **Lucide React** - Icons

## External APIs

- **OpenStreetMap** - Map tiles
- **Nominatim** - Geocoding (restricted to Germany)
- **Deutsche Bahn REST API** - Transit stops & journey planning
- **OSRM** - Walking/cycling route calculation
- **Open-Elevation** - Elevation data

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Development

The app runs on `http://localhost:5173` by default.

## Project Structure

```
src/
├── components/
│   ├── steps/          # Wizard step components
│   ├── ui/             # Reusable UI components
│   ├── Map.jsx         # Leaflet map wrapper
│   ├── ProgressBar.jsx # Step progress indicator
│   └── Wizard.jsx      # Main wizard controller
├── services/
│   ├── geo.js          # Geographic utilities
│   ├── nominatim.js    # Geocoding API
│   ├── osrm.js         # Routing API
│   └── overpass.js     # Transit data API
├── hooks/
│   ├── useDebounce.js
│   └── useGeolocation.js
├── constants/
│   ├── defaults.js
│   └── transitTypes.js
├── App.jsx
├── main.jsx
└── index.css
```

## License

MIT
