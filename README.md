# Run Home 🏃‍♂️🏠

[![E2E Tests](https://github.com/harrypuuter/run-home/actions/workflows/e2e.yml/badge.svg)](https://github.com/harrypuuter/run-home/actions/workflows/e2e.yml)

A simple, elegant app that helps runners and cyclists discover outbound routes that connect to nearby public transit — plan a quick and safe run or ride home using nearby stations and short walking/cycling legs. When available, the app enhances results with Deutsche Bahn journey data.

---

## ✨ Highlights

- Clean, map-first experience to discover running and cycling routes that end near transit stations
- Transit-aware routing: combines walking/cycling legs with transit connections where available
- Instant route preview with distance, duration, and elevation profile
- Export routes as GPX for your watch or navigation app

---

## 📸 Screenshots

<p align="center">
  <img src="/public/screenshots/screenshot-2.png" alt="Route detail" width="720" />
</p>

---

## 🚀 Quick start

1. Install dependencies

```bash
npm install
```

2. Start the dev server

```bash
npm run dev
```

3. Open http://localhost:5173 and try the Debug page for deterministic scenarios: `/run-home/debug`

---

## 🧭 How it helps

- Find routes that fit your preferred distance and direction
- See transit-stop options nearby and select routes that include a convenient transit leg
- Review elevation and export the GPX for navigation or training

---

## ⚠️ Notes

- The app uses OpenStreetMap/Nominatim for geocoding and OSRM for route calculations. When Deutsche Bahn data is available (mainly Germany), transit journeys are shown; otherwise the app still finds sensible walking/cycling routes via OSM.

---

## 🤝 Contributing

Contributions are welcome — opening issues, improving UI, or adding tests helps the project. See `docs/` for design notes and testing guidance.

---

## 📄 License

MIT

## Features

- 📍 Set your home location via map or search (global)
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
- **Nominatim** - Geocoding (global)
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
