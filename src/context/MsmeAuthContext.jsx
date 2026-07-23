import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { msmeApi } from '../api/msmeService';

const MsmeAuthContext = createContext(null);

// Session for the MSME direct portal. Shares the same localStorage `token`
// slot as the DSA app (axiosInstance attaches it), plus a `roleName` marker
// so the two auth worlds never rehydrate each other's tokens.
export const MsmeAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('roleName');
    setUser(null);
    navigate('/msme/login');
  }, [navigate]);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const isMsme = localStorage.getItem('roleName') === 'MSME_CUSTOMER';

      if (token && isMsme) {
        try {
          const res = await msmeApi.getDashboard();
          setUser(res.data.user);
        } catch (err) {
          console.error('Failed to restore MSME session:', err);
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('roleName', 'MSME_CUSTOMER');
    setUser(userData);
  };

  return (
    <MsmeAuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </MsmeAuthContext.Provider>
  );
};

export const useMsmeAuth = () => {
  const ctx = useContext(MsmeAuthContext);
  if (!ctx) throw new Error('useMsmeAuth must be used within MsmeAuthProvider');
  return ctx;
};
