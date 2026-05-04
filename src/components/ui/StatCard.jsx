import React from 'react';
import { TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, subtitle, icon: Icon = TrendingUp, color = 'var(--primary)', loading = false }) => {
  if (loading) {
    return (
      <div className="card card-padded" style={{ minHeight: 110 }}>
        <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 28, width: '35%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '60%' }} />
      </div>
    );
  }

  return (
    <div className="card card-padded" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 3,
        background: color,
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 4 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            {title}
          </p>
          <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
            {value ?? '—'}
          </p>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{subtitle}</p>
          )}
        </div>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--radius)',
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginLeft: 12,
        }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
