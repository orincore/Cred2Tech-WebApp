import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const PageHeader = ({ title, subtitle, breadcrumbs = [], actions }) => (
  <div style={{ marginBottom: 28 }}>
    {breadcrumbs.length > 0 && (
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 10,
        fontSize: 13,
        color: 'var(--text-tertiary)',
        flexWrap: 'wrap',
      }}>
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={14} />}
            {crumb.path ? (
              <Link to={crumb.path} style={{ color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--primary)', fontWeight: i === breadcrumbs.length - 1 ? 500 : 400 }}>
                {crumb.label}
              </Link>
            ) : (
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>
    )}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  </div>
);

export default PageHeader;
