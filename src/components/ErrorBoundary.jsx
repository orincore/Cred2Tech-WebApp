import React from 'react';

// Every route in this app is lazy-loaded (see routes/AppRouter.jsx). Vite
// hashes chunk filenames per build, so a tab left open across a deploy still
// points at chunk URLs that no longer exist on the server — the very next
// navigation to a not-yet-loaded route throws a rejected dynamic import.
// <Suspense> only handles the *pending* state of that import, never a
// rejected one, so with no boundary anywhere in the tree that error
// propagated all the way to the root and unmounted the whole app: a blank
// screen with no way out except a manual refresh.
const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
];

function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(msg));
}

const RELOAD_GUARD_KEY = 'c2t_chunk_reload_attempted';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);

    if (isChunkLoadError(error)) {
      // Self-heal automatically: a stale chunk only ever needs one fresh
      // page load to resolve, since that re-fetches the current index.html
      // and its up-to-date chunk manifest. Guarded by sessionStorage so a
      // genuinely persistent failure (e.g. real network outage) reloads
      // once and then falls through to the visible fallback below instead
      // of looping forever.
      try {
        if (!sessionStorage.getItem(RELOAD_GUARD_KEY)) {
          sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const chunkError = isChunkLoadError(this.state.error);

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 24,
          textAlign: 'center',
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
        }}
      >
        {chunkError ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Updating to the latest version…</p>
        ) : (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 380, margin: 0 }}>
              Please reload the page. If this keeps happening, contact support.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{ borderRadius: 0, padding: '9px 22px', fontWeight: 600 }}
            >
              Reload
            </button>
          </>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
