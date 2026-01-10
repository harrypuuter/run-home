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
  // Mobile extras
  hasMoreCandidates = false,
  calculatingRoutes = false,
  onGenerateMore = null,
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

  // Dragging refs
  const handleRef = useRef(null)
  const pointerIdRef = useRef(null)
  const draggingRef = useRef(false)

  // Start drag
  const [isDraggingState, setIsDraggingState] = useState(false)
  const lastPositionsRef = useRef([]) // [{t, y}]
  const [announce, setAnnounce] = useState('')
  const announcerRef = useRef(null)

  const startDrag = useCallback((clientY) => {
    startYRef.current = clientY
    startTranslateRef.current = translateY
    draggingRef.current = true
    setIsDraggingState(true)
    lastPositionsRef.current = [{ t: performance.now(), y: clientY }]
    document.body.style.userSelect = 'none'
  }, [translateY])

  const onMove = useCallback((clientY) => {
    if (!draggingRef.current) return
    const dy = clientY - startYRef.current
    const next = Math.max(0, Math.min(sheetStates.current.peek, startTranslateRef.current + dy))
    setTranslateY(next)

    // Record recent positions for velocity calculation (keep short history)
    const now = performance.now()
    lastPositionsRef.current.push({ t: now, y: clientY })
    // Keep last 6 samples or last 150ms
    while (lastPositionsRef.current.length > 6 || (now - lastPositionsRef.current[0].t) > 150) {
      lastPositionsRef.current.shift()
    }
  }, [])

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDraggingState(false)
    pointerIdRef.current = null
    document.body.style.userSelect = ''

    // Compute velocity (px per ms)
    const samples = lastPositionsRef.current
    let velocity = 0
    if (samples.length >= 2) {
      const first = samples[0]
      const last = samples[samples.length - 1]
      const dy = last.y - first.y
      const dt = Math.max(1, last.t - first.t)
      velocity = dy / dt // px / ms
    }

    // Fling thresholds (tweakable)
    const FLING_VELOCITY_PX_PER_MS = 0.6 // ~0.6 px/ms
    const FLING_MIN_DISTANCE = sheetStates.current.peek * 0.05 // require small movement relevance

    // Decide based on velocity first (fast gestures)
    if (velocity < -FLING_VELOCITY_PX_PER_MS) {
      // Fast upward swipe -> open fully
      animateTo(sheetStates.current.full)
      return
    }
    if (velocity > FLING_VELOCITY_PX_PER_MS) {
      // Fast downward swipe -> close to peek
      animateTo(sheetStates.current.peek)
      onClose?.()
      return
    }

    // Otherwise snap to nearest state (index-based)
    const distances = [
      { name: 'full', value: sheetStates.current.full },
      { name: 'half', value: sheetStates.current.half },
      { name: 'peek', value: sheetStates.current.peek },
    ]
    let best = distances[0]
    for (const s of distances) {
      if (Math.abs(translateY - s.value) < Math.abs(translateY - best.value)) best = s
    }

    animateTo(best.value)
    if (best.name === 'peek') {
      // Consider it closed if peek
      onClose?.()
    }
  }, [translateY, onClose])

  // Pointer handlers (global listeners for robustness)
  useEffect(() => {
    const onPointerMove = (e) => {
      if (!draggingRef.current) return
      onMove(e.clientY)
    }
    const onPointerUp = (e) => {
      if (!draggingRef.current) return
      try {
        if (handleRef.current && handleRef.current.releasePointerCapture && pointerIdRef.current != null) {
          handleRef.current.releasePointerCapture(pointerIdRef.current)
        }
      } catch (err) {
        // ignore
      }
      endDrag()
    }
    const onPointerCancel = (e) => onPointerUp(e)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [onMove, endDrag])

  const onPointerDown = (e) => {
    // Only primary button for mouse
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointerIdRef.current = e.pointerId
    startDrag(e.clientY)
    // Capture to ensure we receive pointer events even if pointer moves outside
    try {
      if (handleRef.current && handleRef.current.setPointerCapture) handleRef.current.setPointerCapture(e.pointerId)
    } catch (err) {
      // ignore
    }
  }

  // Keyboard accessibility for the handle
  const onHandleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      setTranslateY(sheetStates.current.full)
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      setTranslateY(sheetStates.current.peek)
      onClose?.()
      e.preventDefault()
    } else if (e.key === 'Home') {
      setTranslateY(sheetStates.current.full)
      e.preventDefault()
    } else if (e.key === 'End') {
      setTranslateY(sheetStates.current.peek)
      onClose?.()
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setTranslateY(sheetStates.current.peek)
      onClose?.()
      e.preventDefault()
    } else if (e.key === ' ' || e.key === 'Enter') {
      // Toggle between half and full
      const half = sheetStates.current.half
      const full = sheetStates.current.full
      setTranslateY(prev => (prev === full ? half : full))
      e.preventDefault()
    }
  }

  const animRef = useRef(null)
  const animStateRef = useRef({ running: false })

  // Spring animator: simple damped spring
  function cancelAnimation() {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    animStateRef.current.running = false
  }

  function animateTo(target) {
    cancelAnimation()
    animStateRef.current.running = true

    let y = translateY
    let v = 0
    const stiffness = 0.02 // spring stiffness
    const damping = 0.12 // damping factor

    let last = performance.now()
    function step(now) {
      const dt = Math.min(32, now - last)
      last = now
      // spring force towards target
      const force = (target - y) * stiffness
      v += force * dt
      // damping
      v *= (1 - damping)
      y += v * dt

      // If close enough and velocity small, finish
      if (Math.abs(target - y) < 0.5 && Math.abs(v) < 0.02) {
        setTranslateY(target)
        animStateRef.current.running = false
        animRef.current = null
        return
      }

      setTranslateY(Math.max(0, Math.min(sheetStates.current.peek, Math.round(y))))
      animRef.current = requestAnimationFrame(step)
    }

    animRef.current = requestAnimationFrame(step)
  }

  const sheetStyle = {
    transform: `translateY(${translateY}px)`,
    transition: isDraggingState || animStateRef.current.running ? 'none' : 'transform 320ms cubic-bezier(0.22, 0.8, 0.2, 1)'
  }

  const selectedItem = selectedRouteIndex !== null ? routes[selectedRouteIndex] : null

  // Announce sheet position changes for accessibility when settled
  useEffect(() => {
    if (isDraggingState || animStateRef.current.running) return

    const full = sheetStates.current.full
    const half = sheetStates.current.half
    const peek = sheetStates.current.peek

    const distTo = (v) => Math.abs(translateY - v)
    const nearest = [ { name: 'full', value: full }, { name: 'half', value: half }, { name: 'peek', value: peek } ].reduce((a, b) => distTo(a.value) < distTo(b.value) ? a : b)

    let msg = ''
    if (nearest.name === 'full') msg = 'Sheet expanded'
    else if (nearest.name === 'half') msg = 'Sheet partially expanded'
    else msg = 'Sheet closed'

    if (msg !== announce) setAnnounce(msg)
  }, [translateY, isDraggingState, announce])

  useEffect(() => {
    if (!announce || !announcerRef.current) return
    announcerRef.current.textContent = announce
    const t = setTimeout(() => { if (announcerRef.current) announcerRef.current.textContent = '' }, 3000)
    return () => clearTimeout(t)
  }, [announce])

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-30 md:hidden"
      style={{ height: '65vh', maxHeight: '85vh' }}
      aria-hidden="false"
    >
      {/* Accessibility live region */}
      <div ref={announcerRef} className="sr-only" aria-live="polite" aria-atomic="true" />
      <div
        className="h-full rounded-t-2xl bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 shadow-2xl overflow-hidden"
        style={sheetStyle}
      >
        {/* Handle */}
        <div
          ref={handleRef}
          className="w-full py-2 flex items-center justify-center cursor-grab touch-none"
          onPointerDown={onPointerDown}
          onKeyDown={onHandleKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Drag to expand or collapse routes"
          style={{ touchAction: 'none' }}
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
