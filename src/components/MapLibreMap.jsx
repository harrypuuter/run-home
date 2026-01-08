import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Map style URLs - using OpenFreeMap (free, no API key)
const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/liberty',
}

function MapLibreMap({
  center = [10, 50], // [lng, lat] - MapLibre uses lng,lat order
  zoom = 4,
  marker = null, // [lat, lng] for home location
  routes = [], // Array of { stop, route, color }
  selectedRouteIndex = null,
  hoveredPoint = null,
  onRouteClick,
  onClick,
  className = 'h-64 w-full',
  darkMode = false,
}) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markersRef = useRef([])
  const hoveredMarkerRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [styleLoaded, setStyleLoaded] = useState(false)
  const currentDarkModeRef = useRef(darkMode)

  // Initialize map
  useEffect(() => {
    if (map.current) return // Already initialized

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: darkMode ? MAP_STYLES.dark : MAP_STYLES.light,
        center: marker ? [marker[1], marker[0]] : center, // [lng, lat]
        zoom: zoom,
        attributionControl: true,
      })

      map.current.addControl(new maplibregl.NavigationControl(), 'top-left')

      map.current.on('load', () => {
        setMapLoaded(true)
        setStyleLoaded(true)
      })

      map.current.on('error', (e) => {
        console.error('MapLibre error:', e)
      })

      // Handle map clicks
      map.current.on('click', (e) => {
        onClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      })
    } catch (err) {
      console.error('Failed to initialize map:', err)
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update map style when dark mode changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    // Skip if this is the initial render (darkMode hasn't changed)
    if (currentDarkModeRef.current === darkMode) return
    currentDarkModeRef.current = darkMode

    setStyleLoaded(false)
    map.current.once('style.load', () => {
      setStyleLoaded(true)
    })
    map.current.setStyle(darkMode ? MAP_STYLES.dark : MAP_STYLES.light)
  }, [darkMode, mapLoaded])

  // Add/update home marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !marker) return

    // Remove existing home marker
    const existingHomeMarker = markersRef.current.find(m => m._type === 'home')
    if (existingHomeMarker) {
      existingHomeMarker.remove()
      markersRef.current = markersRef.current.filter(m => m._type !== 'home')
    }

    // Create custom home marker element
    const el = document.createElement('div')
    el.className = 'maplibre-home-marker'
    el.innerHTML = `
      <div style="
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
        cursor: pointer;
      ">
        <span style="transform: rotate(45deg); font-size: 14px;">🏠</span>
      </div>
    `

    const homeMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([marker[1], marker[0]]) // [lng, lat]
      .setPopup(new maplibregl.Popup().setHTML('<strong>🏠 Home</strong>'))
      .addTo(map.current)

    homeMarker._type = 'home'
    markersRef.current.push(homeMarker)
  }, [marker, mapLoaded])

  // Add/update route layers and markers
  useEffect(() => {
    if (!map.current || !mapLoaded || !styleLoaded) return

    // Remove existing route sources and layers (try-catch because style change removes them)
    for (let i = 0; i < 20; i++) {
      const sourceId = `route-${i}`
      try {
        if (map.current.getLayer(`${sourceId}-line`)) {
          map.current.removeLayer(`${sourceId}-line`)
        }
        if (map.current.getLayer(`${sourceId}-line-glow`)) {
          map.current.removeLayer(`${sourceId}-line-glow`)
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId)
        }
      } catch (e) {
        // Ignore - layer/source may not exist after style change
      }
    }

    // Remove existing stop markers
    markersRef.current
      .filter(m => m._type === 'stop')
      .forEach(m => m.remove())
    markersRef.current = markersRef.current.filter(m => m._type !== 'stop')

    if (routes.length === 0) return

    // Add new routes
    routes.forEach((item, index) => {
      if (!item.route?.geometry?.coordinates) return

      const sourceId = `route-${index}`
      const isSelected = selectedRouteIndex === index
      const isVisible = selectedRouteIndex === null || isSelected

      try {
        // Add route source
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: item.route.geometry,
          },
        })

        // Add glow layer for selected route
        if (isSelected) {
          map.current.addLayer({
            id: `${sourceId}-line-glow`,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': item.color,
              'line-width': 12,
              'line-opacity': 0.3,
              'line-blur': 4,
            },
          })
        }

        // Add main route line
        map.current.addLayer({
          id: `${sourceId}-line`,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': item.color,
            'line-width': isSelected ? 5 : 4,
            'line-opacity': isVisible ? (isSelected ? 1 : 0.8) : 0.3,
          },
        })

        // Add click handler for route
        map.current.on('click', `${sourceId}-line`, () => {
          onRouteClick?.(index)
        })

        // Change cursor on hover
        map.current.on('mouseenter', `${sourceId}-line`, () => {
          map.current.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', `${sourceId}-line`, () => {
          map.current.getCanvas().style.cursor = ''
        })
      } catch (err) {
        console.error('Failed to add route layer:', err)
      }

      // Add stop marker
      const stopEl = document.createElement('div')
      stopEl.innerHTML = `
        <div style="
          width: 14px;
          height: 14px;
          background: ${item.color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        "></div>
      `

      const stopMarker = new maplibregl.Marker({ element: stopEl, anchor: 'center' })
        .setLngLat([item.stop.lng, item.stop.lat])
        .setPopup(
          new maplibregl.Popup().setHTML(`
            <strong>${item.stop.name || 'Unnamed Stop'}</strong><br/>
            <span style="color: #666; text-transform: capitalize;">${item.stop.type || 'Transit stop'}</span>
          `)
        )
        .addTo(map.current)

      stopMarker._type = 'stop'
      stopMarker._index = index
      markersRef.current.push(stopMarker)
    })

    // Fit bounds to show all routes
    if (routes.length > 0 && marker) {
      const bounds = new maplibregl.LngLatBounds()
      bounds.extend([marker[1], marker[0]]) // Home

      const routesToShow = selectedRouteIndex !== null
        ? [routes[selectedRouteIndex]].filter(Boolean)
        : routes

      routesToShow.forEach(item => {
        if (item.route?.geometry?.coordinates) {
          item.route.geometry.coordinates.forEach(coord => {
            bounds.extend(coord)
          })
        }
        if (item.stop) {
          bounds.extend([item.stop.lng, item.stop.lat])
        }
      })

      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 350 }, // Extra right padding for cards
        maxZoom: 14,
        duration: 500,
      })
    }
  }, [routes, selectedRouteIndex, mapLoaded, styleLoaded, marker, onRouteClick])

  // Handle hovered point from elevation profile
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove existing hovered marker
    if (hoveredMarkerRef.current) {
      hoveredMarkerRef.current.remove()
      hoveredMarkerRef.current = null
    }

    if (!hoveredPoint || typeof hoveredPoint.lat !== 'number' || typeof hoveredPoint.lng !== 'number') {
      return
    }

    // Validate coordinates
    if (hoveredPoint.lat < -90 || hoveredPoint.lat > 90 || hoveredPoint.lng < -180 || hoveredPoint.lng > 180) {
      return
    }

    const color = selectedRouteIndex !== null && routes[selectedRouteIndex]
      ? routes[selectedRouteIndex].color
      : '#3b82f6'

    const el = document.createElement('div')
    el.innerHTML = `
      <div style="
        width: 16px;
        height: 16px;
        background: ${color};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "></div>
    `

    hoveredMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([hoveredPoint.lng, hoveredPoint.lat])
      .addTo(map.current)
  }, [hoveredPoint, selectedRouteIndex, routes, mapLoaded])

  // Update center when marker changes (for initial positioning)
  useEffect(() => {
    if (!map.current || !mapLoaded || routes.length > 0) return
    if (marker) {
      map.current.flyTo({
        center: [marker[1], marker[0]],
        zoom: zoom,
        duration: 500,
      })
    }
  }, [marker, zoom, mapLoaded, routes.length])

  return (
    <div
      ref={mapContainer}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: '200px' }}
    />
  )
}

export default MapLibreMap
