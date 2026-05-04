import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, HelpCircle, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Badge from '../ui/Badge';
import api from '../../api/axiosInstance';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/profile': 'My Profile',
  '/users': 'Users',
  '/users/create': 'Create User',
  '/hierarchy': 'Hierarchy',
  '/settings': 'Settings',
};

const Topbar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const getTitle = () => {
    // Match /users/:id/edit or /users/:id
    if (/^\/users\/\d+\/edit$/.test(location.pathname)) return 'Edit User';
    if (/^\/users\/\d+$/.test(location.pathname)) return 'User Details';
    return PAGE_TITLES[location.pathname] || 'DSA CRM Admin';
  };

  const [walletBalance, setWalletBalance] = React.useState(null);

  React.useEffect(() => {
     if (user?.role?.name === 'DSA_ADMIN' || user?.role?.name === 'DSA_MEMBER') {
         api.get('/wallet/balance')
         .then(res => setWalletBalance(res.data.balance))
         .catch(err => console.error(err));
     }
  }, [user, location.pathname]); // refetch softly on route change

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 'var(--sidebar-width)',
      right: 0,
      height: 'var(--topbar-height)',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      zIndex: 90,
      gap: 16,
    }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          {getTitle()}
        </h2>
        {user?.dsa?.name && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {user.dsa.name}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {walletBalance !== null && (
           <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20 }}>
              <Wallet size={16} color="var(--primary)" />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{walletBalance.toLocaleString()} Credits</span>
           </div>
        )}
        
        <button className="btn btn-ghost btn-icon" title="Help">
          <HelpCircle size={18} color="var(--text-tertiary)" />
        </button>
        <button className="btn btn-ghost btn-icon" title="Notifications">
          <Bell size={18} color="var(--text-tertiary)" />
        </button>

        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{user?.email}</p>
          </div>
          <Badge type="role" value={user?.role?.name} />
        </div>
      </div>
    </header>
  );
};

export default Topbar;
