import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Home } from 'lucide-react';

const NotFoundPage = () => {
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
        fontSize: 90, fontWeight: 900, lineHeight: 1,
        background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginBottom: 12,
        letterSpacing: '-0.05em',
      }}>
        404
      </div>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: 'var(--primary-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <MapPin size={28} color="var(--primary)" />
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
        Page Not Found
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.7, marginBottom: 32 }}>
        The page you're looking for doesn't exist or has been moved. Double-check the URL or head back to the dashboard.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          <Home size={16} /> Dashboard
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;
