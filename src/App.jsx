import React from 'react';
import AppRouter from './routes/AppRouter';
import DevBanner from './components/DevBanner';

export default function App() {
  return (
    <>
      {import.meta.env.VITE_APP_ENV !== 'production' && <DevBanner />}
      <AppRouter />
    </>
  );
}
