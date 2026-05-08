import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as loginApi, getMe } from '../api/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to rehydrate current user from stored token
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
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
    localStorage.setItem('token', newToken);
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
