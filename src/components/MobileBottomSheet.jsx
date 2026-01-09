import { useEffect, useRef, useState, useCallback } from 'react'
import RouteDetailPanel from './steps/RouteDetailPanel'

// Minimal draggable bottom sheet for mobile. Uses transform translateY to animate.
export default function MobileBottomSheet({
  routes = [],
  selectedRouteIndex,
  onSelect,
  onClose,
  showTransitOnMap,
  onToggleShowTransit,
  activity,
  pace,
  onPaceChange,
  onDownloadGPX,
  onHoverPoint,
  dbApiAvailable,
}) {
  const sheetRef = useRef(null)
  const startYRef = useRef(0)
  const startTranslateRef = useRef(0)
  const [translateY, setTranslateY] = useState(0) // px; 0 = fully open
  const [height, setHeight] = useState(0)

  // Sheet states (values as pixels relative to height)
  const sheetStates = useRef({ peek: 0, half: 0, full: 0 })

  useEffect(() => {
    const node = sheetRef.current
    if (!node) return

    const onResize = () => {
      const h = node.clientHeight
      setHeight(h)
      sheetStates.current = {
        full: 0,
        half: Math.round(h * 0.45),
        peek: Math.round(h * 0.85),
      }
      // Start closed (peek)
      setTranslateY(sheetStates.current.peek)
    }

    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Touch / mouse handlers
  const startDrag = useCallback((clientY) => {
    startYRef.current = clientY
    startTranslateRef.current = translateY
    document.body.style.userSelect = 'none'
  }, [translateY])

  const onMove = useCallback((clientY) => {
    const dy = clientY - startYRef.current
    const next = Math.max(0, Math.min(sheetStates.current.peek, startTranslateRef.current + dy))
    setTranslateY(next)
  }, [])

  const endDrag = useCallback(() => {
    document.body.style.userSelect = ''
    // Snap to closest state
    const distances = [
      { name: 'full', value: sheetStates.current.full },
      { name: 'half', value: sheetStates.current.half },
      { name: 'peek', value: sheetStates.current.peek },
    ]
    let best = distances[0]
    for (const s of distances) {
      if (Math.abs(translateY - s.value) < Math.abs(translateY - best.value)) best = s
    }

    setTranslateY(best.value)
    if (best.name === 'peek') {
      // Consider it closed if peek
      onClose?.()
    }
  }, [translateY, onClose])

  // Pointer handlers
  useEffect(() => {
    const onTouchMove = (e) => {
      onMove(e.touches[0].clientY)
    }
    const onTouchEnd = () => endDrag()

    const onMouseMove = (e) => onMove(e.clientY)
    const onMouseUp = () => endDrag()

    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMove, endDrag])

  const onPointerDown = (e) => {
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    startDrag(clientY)
  }

  const sheetStyle = {
    transform: `translateY(${translateY}px)`,
  }

  const selectedItem = selectedRouteIndex !== null ? routes[selectedRouteIndex] : null

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-30 md:hidden"
      style={{ height: '65vh', maxHeight: '85vh' }}
      aria-hidden="false"
    >
      <div
        className="h-full rounded-t-2xl bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 shadow-2xl overflow-hidden"
        style={sheetStyle}
      >
        {/* Handle */}
        <div
          className="w-full py-2 flex items-center justify-center cursor-grab"
          onMouseDown={onPointerDown}
          onTouchStart={onPointerDown}
        >
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        <div className="p-3 max-h-[calc(65vh-4rem)] overflow-y-auto space-y-2">
          {selectedItem ? (
            <RouteDetailPanel
              item={selectedItem}
              onClose={() => { onClose?.(); setTranslateY(sheetStates.current.peek) }}
              onHoverPoint={onHoverPoint}
              onDownloadGPX={onDownloadGPX}
              activity={activity}
              pace={pace}
              onPaceChange={onPaceChange}
              showTransitOnMap={showTransitOnMap}
              onToggleShowTransit={onToggleShowTransit}
              dbApiAvailable={dbApiAvailable}
            />
          ) : (
            <div className="space-y-2">
              {routes.slice(0, 6).map((item, index) => (
                <button key={item.stop.id} onClick={() => { onSelect(index); setTranslateY(sheetStates.current.half) }} className="w-full text-left p-3 rounded-xl bg-slate-800/80 border border-slate-600/50 hover:bg-slate-800/90">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white text-sm truncate">{item.stop.name}</h4>
                      <p className="text-slate-400 text-xs">{(item.route.distance/1000).toFixed(1)} km</p>
                    </div>
                    <div className="text-slate-400 text-xs">Show</div>
                  </div>
                </button>
              ))}

              {/* Mobile Find More button */}
              {hasMoreCandidates && !calculatingRoutes && (
                <button onClick={() => onGenerateMore?.()} className="w-full p-3 rounded-xl bg-slate-800/60 border border-slate-600/50 text-slate-300 text-sm hover:bg-slate-800/80 transition-colors flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
                  Find More Routes
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
