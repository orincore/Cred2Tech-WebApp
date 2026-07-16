import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as loginApi, getMe } from '../api/authService';

const AuthContext = createContext(null);

// Cookie helper functions
const setCookie = (name, value, days) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const domain = isLocalhost ? '' : '; domain=.cred2tech.com';
  const secure = isLocalhost ? '' : '; Secure';
  const cookieValue = `${name}=${value}; expires=${expires.toUTCString()}; path=/${domain}; SameSite=Lax${secure}`;
  document.cookie = cookieValue;
};

const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const deleteCookie = (name) => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const domain = isLocalhost ? '' : '; domain=.cred2tech.com';
  const secure = isLocalhost ? '' : '; Secure';
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domain}; SameSite=Lax${secure}`;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || getCookie('cred2tech_token'));
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to rehydrate current user from stored token
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token') || getCookie('cred2tech_token');
      if (storedToken) {
        try {
          const userData = await getMe();
          // Normalize tenant type if nested
          const finalUser = userData.user || userData;
          if (finalUser && finalUser.tenant && !finalUser.tenant_type) {
             finalUser.tenant_type = finalUser.tenant.type;
          }
          // Normalize role - handle both object and string formats
          if (finalUser && finalUser.role) {
             if (typeof finalUser.role === 'object' && finalUser.role.name) {
               finalUser.role = finalUser.role.name;
             }
             // Ensure role is uppercase to match navItems
             if (typeof finalUser.role === 'string') {
               finalUser.role = finalUser.role.toUpperCase();
             }
          }
          setUser(finalUser);
        } catch {
          // Token is invalid/expired — clear everything
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          deleteCookie('cred2tech_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginApi(email, password);
    const { token: newToken, user: newUser } = data;
    
    // Store in localStorage for backward compatibility
    localStorage.setItem('token', newToken);
    
    // Set cookie for cross-domain sharing
    setCookie('cred2tech_token', newToken, 7); // 7 days expiry
    
    setToken(newToken);
    if (newUser && newUser.tenant && !newUser.tenant_type) newUser.tenant_type = newUser.tenant.type;
    // Normalize role - handle both object and string formats
    if (newUser && newUser.role) {
      if (typeof newUser.role === 'object' && newUser.role.name) {
        newUser.role = newUser.role.name;
      }
      // Ensure role is uppercase to match navItems
      if (typeof newUser.role === 'string') {
        newUser.role = newUser.role.toUpperCase();
      }
    }
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    deleteCookie('cred2tech_token');
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    logout,
    hasRole: (roles) => {
      if (!user?.role) return false;
      return Array.isArray(roles)
        ? roles.includes(user.role)
        : user.role === roles;
    },
    hasTenantType: (types) => {
      if (!user?.tenant_type) return false;
      return Array.isArray(types)
        ? types.includes(user.tenant_type)
        : user.tenant_type === types;
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
