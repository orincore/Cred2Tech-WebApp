import React from 'react';
import { useTheme } from '../context/ThemeContext';

const Logo = ({ size = 'medium', className = '' }) => {
  const { theme, mounted } = useTheme();
  
  const sizeConfig = {
    small: { height: 24, maxWidth: 100 },
    medium: { height: 30, maxWidth: 120 },
    large: { height: 40, maxWidth: 160 },
    xlarge: { height: 56, maxWidth: 200 }
  };
  
  const { height, maxWidth } = sizeConfig[size] || sizeConfig.medium;
  
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
