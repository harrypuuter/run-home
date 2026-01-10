import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DebugMapLibre from './pages/DebugMapLibre.jsx'

// Simple hash-based routing for debug page
function Router() {
  const path = window.location.pathname

  // Check if we're on the debug route
  if (path.endsWith('/debug') || path.endsWith('/debug/')) {
    return <DebugMapLibre />
  }

  // Default to main app
  return <App />
}

import ErrorBoundary from './components/ErrorBoundary'

// Global handlers to surface uncaught errors/rejections (helps with white-screen debugging)
window.addEventListener('error', (ev) => {
  console.error('[GlobalError] unhandled error:', ev.error || ev.message || ev)
})
window.addEventListener('unhandledrejection', (ev) => {
  console.error('[GlobalError] unhandled rejection:', ev.reason || ev)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  </StrictMode>,
)
