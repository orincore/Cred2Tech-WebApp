import React from 'react';
import { TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, subtitle, icon: Icon = TrendingUp, color = 'var(--primary)', loading = false }) => {
  if (loading) {
    return (
      <div className="card card-padded" style={{ height: '100%', minHeight: 92, boxSizing: 'border-box' }}>
        <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 28, width: '35%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '60%' }} />
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--outline)',
      borderRadius: 0,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 6,
      position: 'relative',
      overflow: 'hidden',
      height: '100%',
      minHeight: 92,
      boxSizing: 'border-box',
    }}>
      {/* Accent bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 3,
        background: color,
        borderRadius: 0,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            {title}
          </p>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--on-surface)', lineHeight: 1.15, margin: '4px 0 0 0' }}>
            {value ?? '—'}
          </p>
          {subtitle && (
            <p style={{ fontSize: 11, color: 'var(--on-muted)', margin: '3px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>
          )}
        </div>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 0,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginLeft: 10,
        }}>
          <Icon size={17} color={color} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
