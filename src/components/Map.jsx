import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in Leaflet with bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom home marker icon
const homeIcon = L.divIcon({
  className: 'custom-home-marker',
  html: `<div style="
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <span style="transform: rotate(45deg); font-size: 14px;">🏠</span>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

// Small transit stop marker for route endpoints
const createSmallTransitIcon = (color) => {
  return L.divIcon({
    className: 'custom-transit-marker',
    html: `<div style="
      width: 12px;
      height: 12px;
      background: ${color};
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

// Component to handle map clicks
function MapClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => {
      onClick?.(e.latlng)
    },
  })
  return null
}

// Component to recenter map when center changes
function MapCenterHandler({ center, zoom }) {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.setView(center, zoom)
    }
  }, [center, zoom, map])

  return null
}

// Component to fit map bounds to show all routes or single selected route
function FitBoundsHandler({ routes, homeLocation, selectedRouteIndex }) {
  const map = useMap()

  useEffect(() => {
    if (routes && routes.length > 0 && homeLocation) {
      const allPoints = [[homeLocation[0], homeLocation[1]]]

      // If a route is selected, only show that route's bounds
      const routesToShow = selectedRouteIndex !== null
        ? [routes[selectedRouteIndex]].filter(Boolean)
        : routes

      routesToShow.forEach(({ route, stop }) => {
        if (route?.geometry?.coordinates) {
          route.geometry.coordinates.forEach(([lng, lat]) => {
            allPoints.push([lat, lng])
          })
        }
        if (stop) {
          allPoints.push([stop.lat, stop.lng])
        }
      })

      if (allPoints.length > 1) {
        const bounds = L.latLngBounds(allPoints)
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      }
    }
  }, [routes, homeLocation, selectedRouteIndex, map])

  return null
}

// Component to show a dot at the hovered point on the elevation profile
function HoveredPointMarker({ point, color }) {
  const map = useMap()
  const circleRef = useRef(null)

  useEffect(() => {
    // Remove existing circle if point is null/invalid
    if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
      if (circleRef.current) {
        map.removeLayer(circleRef.current)
        circleRef.current = null
      }
      return
    }

    // Validate coordinates
    if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
      return
    }

    // Create or update the circle marker
    if (!circleRef.current) {
      circleRef.current = L.circleMarker([point.lat, point.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: color || '#3b82f6',
        fillOpacity: 1,
      }).addTo(map)
    } else {
      circleRef.current.setLatLng([point.lat, point.lng])
      circleRef.current.setStyle({
        fillColor: color || '#3b82f6',
      })
    }
  }, [point, color, map])

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (circleRef.current) {
        map.removeLayer(circleRef.current)
        circleRef.current = null
      }
    }
  }, [map])

  return null // This component doesn't render anything directly
}

function Map({
  center = [50, 10],
  zoom = 4,
  marker = null,
  markerType = 'default',
  routes = [], // Array of { stop, route, color }
  selectedRouteIndex = null,
  hoveredPoint = null, // Point from elevation profile hover
  onClick,
  className = 'h-64 w-full',
  departureTime = null,
}) {
  // Get the color of the selected route for the hovered point marker
  const selectedRouteColor = selectedRouteIndex !== null && routes[selectedRouteIndex]
    ? routes[selectedRouteIndex].color
    : '#3b82f6'

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className}
      scrollWheelZoom={true}
    >
      {/* CartoDB Dark Matter tiles for dark theme */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Map center handler for non-route views */}
      {routes.length === 0 && <MapCenterHandler center={center} zoom={zoom} />}

      {/* Fit bounds to show all routes or selected route */}
      {routes.length > 0 && marker && (
        <FitBoundsHandler routes={routes} homeLocation={marker} selectedRouteIndex={selectedRouteIndex} />
      )}

      {/* Map click handler */}
      {onClick && <MapClickHandler onClick={onClick} />}

      {/* Home marker */}
      {marker && (
        <Marker
          position={marker}
          icon={markerType === 'home' ? homeIcon : new L.Icon.Default()}
          zIndexOffset={1000}
        >
          <Popup>
            {markerType === 'home' ? '🏠 Home' : 'Selected Location'}
          </Popup>
        </Marker>
      )}

      {/* Route polylines - render non-selected first, then selected on top */}
      {routes.map((item, index) => {
        if (selectedRouteIndex !== null && index !== selectedRouteIndex) {
          return item.route?.geometry && (
            <Polyline
              key={`route-${item.stop.id}`}
              positions={item.route.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
              pathOptions={{
                color: item.color,
                weight: 3,
                opacity: 0.3,
              }}
            />
          )
        }
        return null
      })}

      {/* Selected route on top with full opacity */}
      {routes.map((item, index) => {
        if (selectedRouteIndex === null || index === selectedRouteIndex) {
          return item.route?.geometry && (
            <Polyline
              key={`route-selected-${item.stop.id}`}
              positions={item.route.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
              pathOptions={{
                color: item.color,
                weight: selectedRouteIndex === index ? 5 : 4,
                opacity: selectedRouteIndex === null ? 0.8 : 1,
              }}
            />
          )
        }
        return null
      })}

      {/* Hovered point marker from elevation profile */}
      {selectedRouteIndex !== null && (
        <HoveredPointMarker
          point={hoveredPoint}
          color={selectedRouteColor}
        />
      )}

      {/* Small markers at route start points (transit stops) */}
      {routes.map((item, index) => (
        <Marker
          key={`stop-${item.stop.id}`}
          position={[item.stop.lat, item.stop.lng]}
          icon={createSmallTransitIcon(item.color)}
          zIndexOffset={selectedRouteIndex === index ? 500 : 100}
        >
          <Popup>
            <div className="text-sm">
              <strong>{item.stop.name || 'Unnamed Stop'}</strong>
              <br />
              <span className="text-slate-500 capitalize">{item.stop.type}</span>
              {marker && (
                <div className="mt-1">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${marker[0]},${marker[1]}&destination=${item.stop.lat},${item.stop.lng}&travelmode=transit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-400 hover:text-sky-300"
                  >
                    🚆 Transit directions (Home → Stop)
                  </a>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

export default Map
