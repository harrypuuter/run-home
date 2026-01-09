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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
