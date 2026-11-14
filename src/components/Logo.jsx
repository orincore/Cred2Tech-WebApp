import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useBranding } from '../branding/brandingStore';

const Logo = ({ size = 'medium', className = '', surface }) => {
  const { theme, mounted } = useTheme();
  const brand = useBranding();
  
  const sizeConfig = {
    small: { height: 24, maxWidth: 100 },
    medium: { height: 30, maxWidth: 120 },
    large: { height: 40, maxWidth: 160 },
    xlarge: { height: 56, maxWidth: 200 }
  };
  
  const { height, maxWidth } = sizeConfig[size] || sizeConfig.medium;

  // White-label: an org shows ITS logo (or its name as a wordmark when it has none), never the Cred2Tech logo,
  // and can switch the logo off on a surface (login page, sidebar, ...). The main app is untouched below.
  if (brand.isOrg) {
    if (!brand.showLogoOn(surface)) return null;
    // The boxes above were drawn around Cred2Tech's own wide (about 4:1) wordmark. A partner's logo is often squarer, so at the same
    // height it looked small next to ours. Partner logos get larger boxes (the image still scales to fit, never stretched or cropped).
    const ORG_BOX = { small: { height: 28, maxWidth: 112 }, medium: { height: 44, maxWidth: 170 }, large: { height: 60, maxWidth: 230 }, xlarge: { height: 84, maxWidth: 300 } };
    const { height, maxWidth } = ORG_BOX[size] || ORG_BOX.medium;
    const dark = mounted && theme === 'dark';
    // `brightness-0 invert` is how the login brand panel turns the Cred2Tech logo white; an org logo must keep its colours
    const onBrandPanel = /\bbrightness-0\b/.test(className);
    const cls = className.replace(/\b(brightness-0|invert)\b/g, '').trim();
    const src = dark || onBrandPanel ? (brand.logoDark || brand.logoLight) : (brand.logoLight || brand.logoDark);
    const needsChip = onBrandPanel && !!src && !brand.logoDark; // only a light-background logo exists: sit it on a white chip (a text wordmark needs none)
    return (
      <div
        style={{ height: `${height}px`, width: 'auto', maxWidth: `${maxWidth}px`, display: 'flex', alignItems: 'center', ...(needsChip ? { background: '#fff', padding: '4px 10px', borderRadius: 6, width: 'fit-content', maxWidth: 'none' } : {}) }}
        className={cls}
      >
        {src ? (
          <img src={src} alt={brand.name} style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
        ) : (
          <span style={{ fontWeight: 800, fontSize: Math.max(12, Math.min(Math.round(height * 0.62), Math.floor((maxWidth * 1.7) / String(brand.name).length))), lineHeight: 1, letterSpacing: '-0.02em', color: onBrandPanel ? '#ffffff' : 'var(--text-primary, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {brand.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div 
      style={{ 
        height: `${height}px`, 
        width: 'auto', 
        maxWidth: `${maxWidth}px`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center'
      }}
      className={className}
    >
      <img
        src={mounted && theme === 'dark' ? '/logos/white-logo.png' : '/logos/black-logo.png'}
        alt="Cred2Tech"
        style={{ 
          height: '100%', 
          width: '100%', 
          objectFit: 'contain',
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'block'
        }}
      />
    </div>
  );
};

export default Logo;
