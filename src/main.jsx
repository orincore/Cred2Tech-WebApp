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

// Registers public/sw.js: the installable-app shell + low-bandwidth caching, the branded offline fallback
// (replacing the browser's bare "no internet" page), and web push. Registered after `load` so it never competes
// with the current page's own startup for the network/CPU.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // An installed app can stay open for days and never "navigate", which is the browser's own trigger to look for a
      // new sw.js. Ask again whenever the app comes back to the foreground (at most once every 30 minutes).
      let lastCheck = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 30 * 60 * 1000) return;
        lastCheck = Date.now();
        registration.update().catch(() => { /* offline: try again next time */ });
      });
    }).catch(() => { /* best-effort only */ });
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
  // Installed-app launch splash (index.html): only exists in a standalone window, a no-op everywhere else. It waits
  // out its own minimum animation time and any route chunk still downloading before fading away.
  requestAnimationFrame(() => { if (typeof window.__c2tSplashHide === 'function') window.__c2tSplashHide(); })
})
