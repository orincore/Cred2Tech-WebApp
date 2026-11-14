import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import OrgUnavailable from './components/OrgUnavailable'
import { initBranding } from './branding/brandingStore'

// A successful mount means this tab is running the current build — clear
// ErrorBoundary's one-shot reload guard so a chunk-load failure from a
// *future* deploy still gets its own automatic reload, rather than being
// silently blocked by a guard flag left over from a previous deploy's fix.
try { sessionStorage.removeItem('c2t_chunk_reload_attempted'); } catch { /* ignore */ }

// Registers public/sw.js, whose only job is swapping the browser's own bare
// "no internet" page (the Chrome dino game and equivalents elsewhere) for
// our branded public/offline.html when a full-page navigation fails offline
// — a case OfflineOverlay.jsx can't cover since that requires the app's own
// JS to already be running. Registered after `load` so it never competes
// with the current page's own startup for the network/CPU.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* best-effort only */ });
  });
}

// Vite's own signal for a failed dynamic-import preload (stale chunk after a
// deploy) — fires independently of React's render cycle, so it catches cases
// an Error Boundary wouldn't (e.g. a preload triggered outside of render).
// Same one-shot guard as ErrorBoundary so a persistent failure doesn't loop.
window.addEventListener('vite:preloadError', () => {
  try {
    if (!sessionStorage.getItem('c2t_chunk_reload_attempted')) {
      sessionStorage.setItem('c2t_chunk_reload_attempted', '1');
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
});

// Decide FIRST whether this is the main Cred2Tech app or a white-label organisation's site (and load its brand),
// so nothing ever paints with the wrong name, logo or colours. On the main app this resolves immediately.
initBranding().then((branding) => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    branding.status === 'unavailable' ? (
      <OrgUnavailable />
    ) : (
      <React.StrictMode>
        <ErrorBoundary>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </ErrorBoundary>
      </React.StrictMode>
    ),
  )
})
