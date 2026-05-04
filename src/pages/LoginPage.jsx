import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Zap, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/helpers';

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  if (isAuthenticated) return <Navigate to="/" replace />;

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters';
    return e;
  };

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((p) => ({ ...p, [e.target.name]: '' }));
    setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user?.name || 'User'}!`);
      navigate('/');
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: -100, right: -100,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -150, left: -100,
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Left branding panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '60px',
        maxWidth: 520,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <div style={{
            width: 42, height: 42, background: 'var(--primary)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(79,70,229,0.5)',
          }}>
            <Zap size={22} color="white" />
          </div>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>
            DSA CRM
          </span>
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.02em' }}>
          Internal Operations<br />
          <span style={{ color: 'var(--primary-light)' }}>Management Platform</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 1.7, maxWidth: 380 }}>
          A role-based admin platform for managing your supply chain network, DSA hierarchy, and partner ecosystem.
        </p>

        <div style={{ display: 'flex', gap: 24, marginTop: 48 }}>
          {['ADMIN', 'DSA', 'EMPLOYEE'].map((role) => (
            <div key={role} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
              }}>
                {role}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right login form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.97)',
          borderRadius: 20,
          padding: 44,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              Sign in
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
              Enter your credentials to access the platform
            </p>
          </div>

          {apiError && (
            <div className="notice notice-error" style={{ marginBottom: 20 }}>
              <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email address <span className="required">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className={`form-control${errors.email ? ' error-input' : ''}`}
                value={form.email}
                onChange={handleChange}
                placeholder="admin@platform.com"
                autoFocus
              />
              {errors.email && <span className="form-error"><AlertCircle size={12} />{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control${errors.password ? ' error-input' : ''}`}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span className="form-error"><AlertCircle size={12} />{errors.password}</span>}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isLoading}
              style={{ marginTop: 4, justifyContent: 'center' }}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Test credentials hint */}
          <div style={{
            marginTop: 24,
            padding: '14px 16px',
            background: 'var(--primary-subtle)',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Demo Credentials
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong>Admin:</strong> admin@platform.com<br />
              <strong>DSA:</strong> admin@dsacompany.com<br />
              <strong>Password:</strong> password123
            </p>
          </div>

          {/* DSA Self-registration CTA */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, whiteSpace: 'nowrap' }}>New to the platform?</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button
              type="button"
              id="register-dsa-btn"
              onClick={() => navigate('/register-dsa')}
              style={{
                width: '100%',
                padding: '11px 20px',
                background: 'transparent',
                border: '1.5px solid rgba(99,102,241,0.5)',
                borderRadius: 10,
                color: 'var(--primary)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
            >
              🏢 Register as a New DSA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
