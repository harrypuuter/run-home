// Default values for the wizard
export const DEFAULTS = {
  // Distance in km
  distance: 10,

  // Activity type
  activity: 'run',

  // Default transit types (metro and train selected)
  transitTypes: ['metro', 'train'],

  // Default center for map (roughly center of Europe)
  mapCenter: [50.0, 10.0],

  // Default zoom level
  mapZoom: 4,

  // Distance range
  minDistance: 2,
  maxDistance: 150,
}

// Speed estimates for time calculations
export const SPEED_ESTIMATES = {
  run: {
    pace: 6, // min/km
    speed: 10, // km/h
  },
  bike: {
    pace: 3, // min/km
    speed: 20, // km/h
  },
}

// Europe bounding box for search
export const EUROPE_BOUNDS = {
  north: 71.0,
  south: 35.0,
  west: -10.0,
  east: 40.0,
}
