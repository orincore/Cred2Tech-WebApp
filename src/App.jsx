import React from 'react';
import AppRouter from './routes/AppRouter';
import DevBanner from './components/DevBanner';
import OfflineOverlay from './components/OfflineOverlay';

export default function App() {
  return (
    <>
      {import.meta.env.VITE_APP_ENV !== 'production' && <DevBanner />}
      <AppRouter />
      {/* Mounted once at the root, alongside the router rather than inside
          it, so it overlays whatever route is already showing instead of
          navigating away from it — the current URL never changes, which is
          what makes "reload once real connectivity returns" equivalent to
          "bring the user back to the exact page they were on". */}
      <OfflineOverlay />
    </>
  );
}
