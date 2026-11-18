import React from 'react';
import { useBranding } from '../branding/brandingStore';
import { useTheme } from '../context/ThemeContext';

// "Powered by Cred2Tech": the small attribution on a white-label organisation's site, with the Cred2Tech logo under the text.
// Renders ONLY on an org site whose Super Admin has switched the attribution on; nowhere on the main Cred2Tech app.
// The logo follows the light or dark theme exactly like the main app's own logo does.
// `inline` puts the text and logo on one line (used in the sidebar footer); the default stacks them.
const PoweredBy = ({ className = '', align = 'center', inline = false, style }) => {
  const { isOrg, poweredBy } = useBranding();
  const { theme, mounted } = useTheme();
  if (!isOrg || !poweredBy) return null;
  const items = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  const logoHeight = inline ? 18 : 30;
  return (
    <div
      className={className}
      style={inline
        ? { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: items, gap: 8, fontSize: 11, lineHeight: 1.4, color: 'var(--text-tertiary, #64748b)', opacity: 0.9, ...style }
        : { display: 'flex', flexDirection: 'column', alignItems: items, gap: 4, fontSize: 11, lineHeight: 1.4, color: 'var(--text-tertiary, #64748b)', opacity: 0.9, ...style }}
    >
      <span>Powered by</span>
      <a href="https://cred2tech.com" target="_blank" rel="noopener noreferrer" aria-label="Cred2Tech" style={{ display: 'inline-flex', lineHeight: 0 }}>
        <img
          src={mounted && theme === 'dark' ? '/logos/white-logo.png' : '/logos/black-logo.png'}
          alt="Cred2Tech"
          height={logoHeight}
          style={{ height: logoHeight, width: 'auto', display: 'block' }}
        />
      </a>
    </div>
  );
};

export default PoweredBy;
