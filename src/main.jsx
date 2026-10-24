import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Offline support for the built site; the dev server is left alone.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
