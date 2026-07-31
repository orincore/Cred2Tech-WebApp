import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { msmeApi, msmeAuthApi } from '../api/msmeService';

const MsmeAuthContext = createContext(null);

// Session for the MSME direct portal. Shares the same localStorage `token`
// slot as the DSA app (axiosInstance attaches it), plus a `roleName` marker
// so the two auth worlds never rehydrate each other's tokens.
export const MsmeAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('roleName', 'MSME_CUSTOMER');
    setUser(userData);
  };

  const logout = useCallback(() => {
    // Fired before localStorage is cleared below — the axios interceptor
    // reads the token synchronously when the request is built, so this is
    // still authenticated even though we don't wait for the response. This
    // is what actually revokes the session server-side (and propagates the
    // logout to scheme.cred2tech.com) rather than just tidying up the
    // bootstrap cookie — without it, a stolen/lingering token would keep
    // working on both apps until its natural 1-day expiry.
    msmeAuthApi.logout().catch(() => {});
    msmeAuthApi.ssoLogout().catch(() => {}); // best-effort — don't block local logout on it
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
      } else {
        // No local session — check whether the user was recently
        // authenticated on scheme.cred2tech.com and can be silently signed
        // in here too via the shared c2t_sso cookie. A 401 (no cookie, or
        // not cross-logged-in) is the normal/expected case, not an error.
        try {
          const res = await msmeAuthApi.ssoCheck();
          login(res.data.user, res.data.token);
        } catch (err) {
          // Not cross-logged-in — fall through to the normal login screen.
        }
      }
      setLoading(false);
    };
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
