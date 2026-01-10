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
  routes = [], // Array of { stop, route, color, editMode, editableWaypoints }
  selectedRouteIndex = null,
  hoveredPoint = null,
  highlightedWaypointIndex = null, // Index of waypoint to highlight
  mapRevision = 0, // Revision counter to force re-render when waypoints change
  onRouteClick,
  onClick,
  className = 'h-64 w-full',
  darkMode = false,
  // Transit overlay: GeoJSON feature (LineString) to show transit journey
  transitOverlay = null,
  transitColor = '#3b82f6',
  // Route editor callback
  onAddWaypoint,
}) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markersRef = useRef([])
  const hoveredMarkerRef = useRef(null)
  const routeHandlersRef = useRef([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [styleLoaded, setStyleLoaded] = useState(false)
  const currentDarkModeRef = useRef(darkMode)

  // Use refs to avoid stale closures in event handlers
  // Update refs synchronously during render (before effects run) to ensure click handlers always have fresh values
  const routesRef = useRef(routes)
  routesRef.current = routes
  const selectedRouteIndexRef = useRef(selectedRouteIndex)
  selectedRouteIndexRef.current = selectedRouteIndex
  const onAddWaypointRef = useRef(onAddWaypoint)
  onAddWaypointRef.current = onAddWaypoint
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  // Compute dependency values outside useEffect so they can be used in dependency array
  const waypointSum = routes?.reduce((sum, r) => sum + (r?.editableWaypoints?.length || 0), 0) || 0
  const routeDistances = routes?.map(r => r?.route?.distance || 0).join(',') || ''

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
        preserveDrawingBuffer: true, // Helps with WebGL context
        failIfMajorPerformanceCaveat: false,
      })

      map.current.addControl(new maplibregl.NavigationControl(), 'top-left')

      map.current.on('load', () => {
        console.log('[MapLibreMap] Map loaded successfully')
        // Expose map instance for E2E tests/debugging
        try { window.__runhome_map = map.current } catch (e) { /* ignore non-browser env */ }
        setMapLoaded(true)
        setStyleLoaded(true)
      })

      map.current.on('error', (e) => {
        console.error('MapLibre error:', e)
      })

      // Handle WebGL context loss/restore
      const canvas = map.current.getCanvas()
      canvas.addEventListener('webglcontextlost', (e) => {
        console.warn('[MapLibreMap] WebGL context lost, preventing default')
        e.preventDefault()
      })
      canvas.addEventListener('webglcontextrestored', () => {
        console.log('[MapLibreMap] WebGL context restored')
        // Trigger re-render of map content
        setMapLoaded(false)
        setTimeout(() => {
          setMapLoaded(true)
          setStyleLoaded(true)
        }, 100)
      })

      // Handle map clicks - use refs to avoid stale closures
      map.current.on('click', (e) => {
        try {
          const sel = selectedRouteIndexRef.current
          const currentRoutes = routesRef.current
          const editing = sel != null && currentRoutes?.[sel]?.editMode
          if (editing && onAddWaypointRef.current) {
            onAddWaypointRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng })
            return
          }
        } catch (err) {
          // Fallback: if anything goes wrong, fall back to regular click handler
        }
        onClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      })
    } catch (err) {
      console.error('Failed to initialize map:', err)
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
        setMapLoaded(false)
        setStyleLoaded(false)
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
      .setPopup(new maplibregl.Popup({ closeButton: false }).setHTML('<strong>🏠 Home</strong>'))
      .addTo(map.current)

    homeMarker._type = 'home'
    markersRef.current.push(homeMarker)
  }, [marker, mapLoaded, styleLoaded])

  // Add/update route layers and markers
  useEffect(() => {
    if (!map.current || !mapLoaded || !styleLoaded) return

    // Handle editable waypoints: remove previous waypoint markers
    markersRef.current
      .filter(m => m._type === 'waypoint')
      .forEach(m => m.remove())
    markersRef.current = markersRef.current.filter(m => m._type !== 'waypoint')

    if (!routes || routes.length === 0) return

    // Check if map is still valid
    if (!map.current.loaded() || !map.current.isStyleLoaded()) return

    // Remove previous event handlers
    routeHandlersRef.current.forEach(({ layerId, type, handler }) => {
      try {
        map.current.off(type, layerId, handler)
      } catch (e) {
        // Ignore - layer may no longer exist
      }
    })
    routeHandlersRef.current = []

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
        if (map.current.getLayer(`${sourceId}-direction`)) {
          map.current.removeLayer(`${sourceId}-direction`)
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

      // Render editable waypoints for the selected route if provided
      if (item.editableWaypoints && item.editableWaypoints.length > 0) {
        item.editableWaypoints.forEach((wp, widx) => {
          const isHighlighted = (selectedRouteIndex === index && highlightedWaypointIndex === widx)
          const waypointLabel = widx + 1
          const el = document.createElement('div')
          el.innerHTML = `
            <div style="
              position: relative;
              width: ${isHighlighted ? '28px' : '24px'};
              height: ${isHighlighted ? '28px' : '24px'};
              background: ${isHighlighted ? '#ef4444' : '#f59e0b'};
              border-radius: 50%;
              border: ${isHighlighted ? '3px' : '2px'} solid white;
              box-shadow: 0 ${isHighlighted ? '2' : '1'}px ${isHighlighted ? '8' : '4'}px rgba(0,0,0,${isHighlighted ? '0.5' : '0.3'});
              cursor: pointer;
              transition: all 0.2s ease;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span style="
                color: white;
                font-size: ${isHighlighted ? '14px' : '12px'};
                font-weight: bold;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                line-height: 1;
              ">${waypointLabel}</span>
            </div>
          `

          const wpMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([wp.lng, wp.lat])
            .addTo(map.current)

          wpMarker._type = 'waypoint'
          wpMarker._routeIndex = index
          wpMarker._wpIndex = widx
          markersRef.current.push(wpMarker)
        })
      }

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
              // Smooth transitions for glow when toggling selection
              'line-opacity-transition': { duration: 300, delay: 0 },
              'line-blur-transition': { duration: 300, delay: 0 },
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
            // Transitions for width/opacity to animate selection/dimming
            'line-width-transition': { duration: 300, delay: 0 },
            'line-opacity-transition': { duration: 300, delay: 0 },
          },
        })

        // Add animated direction indicator for selected route
        if (isSelected) {
          map.current.addLayer({
            id: `${sourceId}-direction`,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#ffffff',
              'line-width': 2,
              'line-opacity': 0.6,
              'line-dasharray': [0, 2, 1],
            },
          })
        }

        // Add click handler for route and store for cleanup
        const clickHandler = () => {
          onRouteClick?.(index)
        }
        const mouseEnterHandler = () => {
          map.current.getCanvas().style.cursor = 'pointer'
        }
        const mouseLeaveHandler = () => {
          map.current.getCanvas().style.cursor = ''
        }

        map.current.on('click', `${sourceId}-line`, clickHandler)
        map.current.on('mouseenter', `${sourceId}-line`, mouseEnterHandler)
        map.current.on('mouseleave', `${sourceId}-line`, mouseLeaveHandler)

        // Store handlers for cleanup
        routeHandlersRef.current.push(
          { layerId: `${sourceId}-line`, type: 'click', handler: clickHandler },
          { layerId: `${sourceId}-line`, type: 'mouseenter', handler: mouseEnterHandler },
          { layerId: `${sourceId}-line`, type: 'mouseleave', handler: mouseLeaveHandler }
        )
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
          new maplibregl.Popup({ closeButton: false }).setHTML(`
            <strong>${item.stop.name || 'Unnamed Stop'}</strong><br/>
            <span style="color: #94a3b8; text-transform: capitalize;">${item.stop.type || 'Transit stop'}</span>
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
        padding: { top: 60, bottom: 60, left: 60, right: Math.max(400, window.innerWidth * 0.38) }, // 35% + margin for side panel
        maxZoom: 14,
        duration: 500,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, selectedRouteIndex, highlightedWaypointIndex, mapLoaded, styleLoaded, marker, onRouteClick, waypointSum, routeDistances, mapRevision])

  // Animate the direction indicator dash pattern for selected route
  useEffect(() => {
    if (!map.current || !mapLoaded || !styleLoaded || selectedRouteIndex === null) return

    const directionLayerId = `route-${selectedRouteIndex}-direction`
    let animationFrame = null
    let dashOffset = 0

    const animate = () => {
      if (!map.current || !map.current.getLayer(directionLayerId)) return
      
      // Slowly increment the dash offset to create movement
      dashOffset = (dashOffset + 0.1) % 3
      
      try {
        // Create moving dash pattern: [gap before, dash, gap after]
        // By shifting these values, we create the illusion of movement
        const dashArray = [dashOffset, 2, 1 + (3 - dashOffset) % 3]
        map.current.setPaintProperty(directionLayerId, 'line-dasharray', dashArray)
      } catch (e) {
        // Layer might not exist, stop animation
        return
      }
      
      animationFrame = requestAnimationFrame(animate)
    }

    // Start animation with a small delay to ensure layer exists
    const startTimeout = setTimeout(() => {
      if (map.current?.getLayer(directionLayerId)) {
        animate()
      }
    }, 100)

    return () => {
      clearTimeout(startTimeout)
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [selectedRouteIndex, mapLoaded, styleLoaded])

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

  // Transit overlay: dashed line to show transit journey when requested
  useEffect(() => {
    if (!map.current || !mapLoaded || !styleLoaded) return

    const sourceId = 'transit-overlay'
    const lineId = `${sourceId}-line`
    const glowId = `${sourceId}-glow`

    // Remove existing transit layers/sources
    try {
      if (map.current.getLayer(glowId)) map.current.removeLayer(glowId)
      if (map.current.getLayer(lineId)) map.current.removeLayer(lineId)
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId)
    } catch (e) {
      // ignore errors when style changes
    }

    if (!transitOverlay || !transitOverlay.geometry || !transitOverlay.geometry.coordinates) return

    try {
      map.current.addSource(sourceId, { type: 'geojson', data: transitOverlay })

      // Glow layer
      map.current.addLayer({
        id: glowId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': transitColor || '#3b82f6',
          'line-width': 10,
          'line-opacity': 0.15,
          'line-blur': 4,
        },
      })

      // Dashed transit line
      map.current.addLayer({
        id: lineId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': transitColor || '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.95,
          'line-dasharray': [2, 2],
        },
      })
    } catch (err) {
      console.error('Failed to add transit overlay:', err)
    }

    return () => {
      try {
        if (map.current.getLayer(glowId)) map.current.removeLayer(glowId)
        if (map.current.getLayer(lineId)) map.current.removeLayer(lineId)
        if (map.current.getSource(sourceId)) map.current.removeSource(sourceId)
      } catch (e) {
        // ignore
      }
    }
  }, [transitOverlay, transitColor, mapLoaded, styleLoaded])

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
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '200px' }}>
      <div
        id="main-map"
        ref={mapContainer}
        className={className}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Edit mode indicator */}
      {selectedRouteIndex != null && routes?.[selectedRouteIndex]?.editMode && (
        <div className="absolute left-3 top-3 z-30">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg border border-slate-700/50">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-medium">Tap map to add waypoint</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapLibreMap
