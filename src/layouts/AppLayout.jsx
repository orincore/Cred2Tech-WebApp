import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { Toaster } from 'react-hot-toast';

const AppLayout = () => (
  <div className="app-shell">
    <Sidebar />
    <div className="app-main">
      <Topbar />
      <main className="page-content">
        <Outlet />
      </main>
    </div>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        },
      }}
    />
  </div>
);

export default AppLayout;
