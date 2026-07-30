import React, { useEffect, useState } from 'react';
import { ChevronRight, Wallet } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axiosInstance';

const WALLET_ROLES = ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];

/**
 * `actions` is an optional right-aligned slot for page-level controls (e.g. an
 * "Add New Customer" button), rendered alongside the wallet chip rather than in
 * a separate row underneath the header. Omitting it — as all other pages do —
 * leaves the header rendering exactly as before.
 */
const PageHeader = ({ title, subtitle, breadcrumbs = [], actions = null }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [walletBalance, setWalletBalance] = useState(null);

  useEffect(() => {
    if (WALLET_ROLES.includes(user?.role)) {
      api.get('/wallet/balance')
        .then(res => setWalletBalance(res.data.balance))
        .catch(() => {});
    } else {
      setWalletBalance(null);
    }
  }, [user?.role]);

  return (
    <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', width: '100%' }}>
      <div>
        {breadcrumbs.length > 0 && (
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 10,
            fontSize: 13,
            color: 'var(--text-tertiary)',
            flexWrap: 'wrap',
          }}>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={14} />}
                {crumb.path ? (
                  <Link to={crumb.path} style={{ color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--primary)', fontWeight: i === breadcrumbs.length - 1 ? 500 : 400 }}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{subtitle}</p>}
      </div>

      {/* Right-hand group: wallet chip and any page-level actions share one
          row and wrap together on narrow screens. */}
      {(walletBalance !== null || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          {walletBalance !== null && (
            <button
              onClick={() => navigate('/wallet')}
              title="View wallet"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--outline)',
                borderRadius: 0,
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-low)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
            >
              <Wallet size={16} color="var(--primary)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{walletBalance.toLocaleString()} Credits</span>
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
