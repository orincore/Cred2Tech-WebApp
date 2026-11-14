import React from 'react';
import { useBranding } from '../branding/brandingStore';

// "Powered by Cred2Tech": the small attribution line on a white-label organisation's site. Renders ONLY on an
// org site whose Super Admin has switched the attribution on; nowhere on the main Cred2Tech app.
const PoweredBy = ({ className = '', align = 'center', style }) => {
  const { isOrg, poweredBy } = useBranding();
  if (!isOrg || !poweredBy) return null;
  return (
    <p
      className={className}
      style={{ fontSize: 11, lineHeight: 1.4, textAlign: align, color: 'var(--text-tertiary, #64748b)', opacity: 0.85, ...style }}
    >
      Powered by{' '}
      <a href="https://cred2tech.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
        Cred2Tech
      </a>
    </p>
  );
};

export default PoweredBy;
