import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// Theme colors matching the website's theme.ts
const themeColors = {
  light: {
    bg: '#eef4ff',
    surface: '#ffffff',
    surfaceLow: '#e0eaff',
    onSurface: '#0a1628',
    onMuted: '#0a1628',
    outline: '#c7d2fe',
  },
  dark: {
    bg: '#0a1628',
    surface: '#162048',
    surfaceLow: '#1e2a5c',
    onSurface: '#e6edf7',
    onMuted: '#e6edf7',
    outline: '#2d3a6c',
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(systemPrefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('theme', theme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      
      // Set CSS variables to match website's theme system
      const colors = themeColors[theme];
      document.documentElement.style.setProperty('--bg', colors.bg);
      document.documentElement.style.setProperty('--surface', colors.surface);
      document.documentElement.style.setProperty('--surface-low', colors.surfaceLow);
      document.documentElement.style.setProperty('--on-surface', colors.onSurface);
      document.documentElement.style.setProperty('--on-muted', colors.onMuted);
      document.documentElement.style.setProperty('--outline', colors.outline);
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
