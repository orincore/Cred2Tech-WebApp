import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldOff, Home } from 'lucide-react';

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: 40,
      textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'var(--error-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(239,68,68,0.15)',
      }}>
        <ShieldOff size={36} color="var(--error)" />
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)' }}>
        Access Denied
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 380, lineHeight: 1.7, marginBottom: 32 }}>
        You don't have the required permissions to view this page. Please contact your administrator if you believe this is an error.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>
        <Home size={16} /> Back to Dashboard
      </button>
    </div>
  );
};

export default UnauthorizedPage;
