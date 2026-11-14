import React from 'react';
import { useBranding } from '../branding/brandingStore';
import { useTheme } from '../context/ThemeContext';

// "Powered by Cred2Tech": the small attribution on a white-label organisation's site, with the Cred2Tech logo under the text.
// Renders ONLY on an org site whose Super Admin has switched the attribution on; nowhere on the main Cred2Tech app.
// The logo follows the light or dark theme exactly like the main app's own logo does.
const PoweredBy = ({ className = '', align = 'center', style }) => {
  const { isOrg, poweredBy } = useBranding();
  const { theme, mounted } = useTheme();
  if (!isOrg || !poweredBy) return null;
  const items = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', alignItems: items, gap: 4, fontSize: 11, lineHeight: 1.4, color: 'var(--text-tertiary, #64748b)', opacity: 0.9, ...style }}
    >
      <span>Powered by</span>
      <a href="https://cred2tech.com" target="_blank" rel="noopener noreferrer" aria-label="Cred2Tech" style={{ display: 'inline-flex', lineHeight: 0 }}>
        <img
          src={mounted && theme === 'dark' ? '/logos/white-logo.png' : '/logos/black-logo.png'}
          alt="Cred2Tech"
          height={20}
          style={{ height: 20, width: 'auto', display: 'block' }}
        />
      </a>
    </div>
  );
};

export default PoweredBy;
