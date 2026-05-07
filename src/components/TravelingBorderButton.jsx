import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const TravelingBorderButton = ({ onClick, type = 'button', children, className = '', showIcon = true, size = 'normal', theme: themeOverride, solid = false, disabled = false }) => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isLight = themeOverride === 'light' || (themeOverride === undefined && mounted && theme === 'light');
  
  // For solid buttons, we use dark blue in light mode, white in dark mode
  const textColor = solid 
    ? (isLight ? 'text-white' : 'text-[#0a1628]') 
    : (isLight ? 'text-[#0a1628]' : 'text-white');

  const content = (
    <>
      {/* The White/Black Highlight — Traveling border path */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <rect 
          x="0" y="0" 
          width="100%" 
          height="100%" 
          rx={size === 'sm' ? "10" : "14"} 
          ry={size === 'sm' ? "10" : "14"} 
          fill="none" 
          stroke={solid ? (isLight ? "white" : "#0a1628") : (isLight ? "#0a1628" : "white")}
          strokeWidth="3" 
          strokeDasharray="140 1000" 
          strokeDashoffset="140"
          style={{ 
            strokeDashoffset: 'var(--dash-offset, 140)',
            transition: `stroke-dashoffset ${size === 'sm' ? '1.5s' : '1.2s'} cubic-bezier(0.4, 0, 0.2, 1)`
          }}
          className={size === 'sm' ? "group-hover:[--dash-offset:-200]" : "group-hover:[--dash-offset:-500]"}
        />
      </svg>
      
      <span className="relative z-10">{children}</span>
      {showIcon && (
        <svg className={`relative z-10 transition-transform duration-300 group-hover:translate-x-1 ${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      )}
    </>
  );

  const baseClasses = `relative inline-flex items-center justify-center gap-2.5 font-bold transition-all duration-300 group overflow-visible shadow-lg hover:scale-[1.03] active:scale-95 ${textColor} ${
    size === 'sm' ? 'px-6 py-2.5 text-[13px] rounded-[10px]' : 'px-10 py-4 text-[17px] rounded-[14px]'
  } ${disabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''} ${className}`;
  
  const baseStyle = {
    background: solid 
      ? (isLight ? '#0a1628' : '#ffffff') 
      : (isLight ? 'rgba(10, 22, 40, 0.03)' : 'rgba(255,255,255,0.03)'),
    border: `2px solid ${solid ? 'transparent' : (isLight ? 'rgba(10, 22, 40, 0.05)' : 'rgba(255,255,255,0.05)')}`,
  };

  return (
    <button type={type} className={baseClasses} style={baseStyle} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
};

export default TravelingBorderButton;
