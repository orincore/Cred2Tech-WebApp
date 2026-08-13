import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { login as loginApi, getMe } from '../api/authService';
import * as mfaApi from '../api/mfaService';

const AuthContext = createContext(null);

// Auto-logout after this long with no user activity anywhere on the page.
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

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

// Shared by initializeAuth, login-success, and MFA-completion paths so the
// user object always ends up in the same normalized shape regardless of
// which flow produced it.
const normalizeUser = (rawUser) => {
  const finalUser = rawUser.user || rawUser;
  if (finalUser && finalUser.tenant && !finalUser.tenant_type) {
    finalUser.tenant_type = finalUser.tenant.type;
  }
  if (finalUser && finalUser.role) {
    if (typeof finalUser.role === 'object' && finalUser.role.name) {
      finalUser.role = finalUser.role.name;
    }
    if (typeof finalUser.role === 'string') {
      finalUser.role = finalUser.role.toUpperCase();
    }
  }
  // MFA is mandatory for every account that reaches this normalizer (MSME
  // customers use a separate context/login entirely) — ProtectedRoute reads
  // this flag to force the setup screen for accounts that don't have it yet.
  finalUser.mfaEnabled = !!(finalUser.mfa_email_enabled || finalUser.mfa_totp_enabled);
  return finalUser;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || getCookie('cred2tech_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Re-reads whatever token is currently in localStorage/cookie and
  // rehydrates user/token state from it. Exposed (not just used on mount)
  // because this context and MsmeAuthContext are two independent React
  // contexts that both read/write the same `token` localStorage slot —
  // MsmeAuthContext.login() writes a fresh token there directly, but has no
  // way to update *this* context's own in-memory state. Without calling
  // this afterward, an MSME customer who navigates to a shared route like
  // /tickets (served by AppLayout, which uses this context) would hit a
  // stale isAuthenticated:false from before they logged in and get bounced
  // to /login — i.e. appear to "log out" even though their session is fine.
  const syncFromStorage = useCallback(async () => {
    const storedToken = localStorage.getItem('token') || getCookie('cred2tech_token');
    if (!storedToken) {
      setToken(null);
      setUser(null);
      return null;
    }
    try {
      const userData = await getMe();
      const finalUser = normalizeUser(userData);
      setToken(storedToken);
      setUser(finalUser);
      return finalUser;
    } catch {
      // Token is invalid/expired — clear everything
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      deleteCookie('cred2tech_token');
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // On mount, try to rehydrate current user from stored token
  useEffect(() => {
    syncFromStorage().finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persists a real session the same way every completed-auth path ends up
  // (fresh login + MFA, or first-time MFA setup completion) — extracted so
  // both call sites stay in sync instead of duplicating the storage logic.
  const persistSession = useCallback((newToken, rawUser) => {
    localStorage.setItem('token', newToken);
    // Clear any MSME-portal session marker so 401 handling routes to /login
    localStorage.removeItem('roleName');
    setCookie('cred2tech_token', newToken, 7); // 7 days expiry
    setToken(newToken);
    const finalUser = normalizeUser(rawUser);
    setUser(finalUser);
    return finalUser;
  }, []);

  // Every staff/DSA/admin account now requires MFA, so this never returns a
  // logged-in user directly anymore — it returns either an mfaRequired
  // (already has a method set up) or mfaSetupRequired (first time) shape,
  // which LoginPage branches on to navigate to /mfa-challenge or /mfa-setup.
  const login = useCallback(async (email, password) => {
    return await loginApi(email, password);
  }, []);

  const verifyMfaChallenge = useCallback(async ({ challengeToken, method, code, trustDevice = false }) => {
    let data;
    if (method === 'TOTP') data = await mfaApi.challengeVerifyTotp(challengeToken, code, trustDevice);
    else if (method === 'EMAIL_OTP') data = await mfaApi.challengeVerifyEmailOtp(challengeToken, code, trustDevice);
    else if (method === 'MOBILE_OTP') data = await mfaApi.challengeVerifyMobileOtp(challengeToken, code, trustDevice);
    else if (method === 'BACKUP_CODE') data = await mfaApi.challengeVerifyBackupCode(challengeToken, code, trustDevice);
    else throw new Error('Unknown verification method');
    return persistSession(data.token, data.user);
  }, [persistSession]);

  // Local-dev only — mirrors verifyMfaChallenge but skips real code
  // verification entirely (mfaApi.challengeDevBypass's backend hard-refuses
  // once NODE_ENV === 'production').
  const devBypassMfaChallenge = useCallback(async (challengeToken) => {
    const data = await mfaApi.challengeDevBypass(challengeToken);
    return persistSession(data.token, data.user);
  }, [persistSession]);

  // Called once at least one MFA method has been confirmed during forced
  // first-time setup — the setup endpoints (mfa.service.js finalizeSetupSuccess)
  // return the same {token, user} shape a completed challenge does.
  const completeMfaSetup = useCallback((data) => {
    if (!data.setupComplete) return null;
    return persistSession(data.token, data.user);
  }, [persistSession]);

  // Called when /auth/login itself returns loginComplete: true — this
  // browser presented a still-valid "trust this device" cookie for this
  // exact account, so the backend skipped the MFA challenge entirely and
  // already issued a real session (auth.service.js loginUser +
  // mfa.service.js finalizeTrustedDeviceLogin). Same {token, user} shape as
  // a completed challenge/setup.
  const applyTrustedDeviceLogin = useCallback((data) => {
    if (!data.loginComplete) return null;
    return persistSession(data.token, data.user);
  }, [persistSession]);

  // Re-fetches /auth/me and updates the in-memory user — used after an
  // already-authenticated old-session account (no setupToken, redirected
  // here by ProtectedRoute) completes MFA setup via the /manage/* endpoints,
  // so mfaEnabled flips to true without needing a fresh login.
  const refreshUser = useCallback(async () => {
    const userData = await getMe();
    const finalUser = normalizeUser(userData);
    setUser(finalUser);
    return finalUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roleName');
    deleteCookie('cred2tech_token');
    setToken(null);
    setUser(null);
  }, []);

  // Auto-logout after IDLE_TIMEOUT_MS with zero activity anywhere on the
  // page — a single setTimeout that gets cleared and restarted on every
  // activity event, rather than a polling interval, so it costs nothing
  // between events regardless of how bursty mousemove/scroll get. Only
  // armed while actually signed in — no point running it on /login itself,
  // and it must disarm immediately on logout (this session's own action or
  // a previous idle-timeout) so it can't loop.
  useEffect(() => {
    if (!token) return undefined;

    let timeoutId;
    const handleIdle = () => {
      logout();
      toast.error("You've been signed out due to inactivity.");
    };
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleIdle, IDLE_TIMEOUT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [token, logout]);

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    verifyMfaChallenge,
    devBypassMfaChallenge,
    completeMfaSetup,
    applyTrustedDeviceLogin,
    refreshUser,
    syncFromStorage,
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
