import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import { onWalletChanged } from '../lib/walletEvents';

const LOW_BALANCE_THRESHOLD = 100;
// Same cadence as VirtualWorkspaceGraceBanner's own poll — cheap enough to
// run alongside it, and clears itself once the DSA recharges from another
// tab/device without needing a full page reload.
const POLL_MS = 5 * 60 * 1000;
const DSA_ROLES = ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];

// Persistent, site-wide (rendered once in AppLayout, same placement as
// VirtualWorkspaceGraceBanner) — a DSA whose wallet balance has dropped
// below ₹100 gets warned everywhere, not just on the Wallet page they might
// not visit before a paid pull (GST/ITR/Bank/Bureau/Salary OCR) fails
// mid-case for insufficient credits.
// GET /wallet/balance itself already scopes correctly per role
// (dsa.wallet.controller.js#getBalance — DSA_MEMBER/SUB_DSA get their own
// EmployeeWallet balance, DSA_ADMIN the tenant wallet), so no extra
// role-branching is needed here beyond gating which roles even have a
// wallet to check.
const LowWalletBalanceBanner = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const isDsa = hasRole(DSA_ROLES);

  const fetchBalance = useCallback(async () => {
    if (!isDsa) return;
    try {
      const res = await api.get('/wallet/balance');
      setBalance(res.data?.balance ?? null);
    } catch {
      // Non-fatal — banner just stays hidden if this fails.
    }
  }, [isDsa]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // A recharge (or free-credit code, or credits from the owner) must clear the banner AT ONCE, not at the next 5-minute poll.
  // Re-read right away, then twice more shortly after: when the payment gateway's confirmation reaches us a moment after the
  // checkout closes, the credits land a few seconds later and the first read can still show the old balance.
  // Coming back to the tab (e.g. after paying elsewhere) re-reads too.
  useEffect(() => {
    if (!isDsa) return undefined;
    let timers = [];
    const refresh = () => {
      fetchBalance();
      timers.forEach(clearTimeout);
      timers = [setTimeout(fetchBalance, 2000), setTimeout(fetchBalance, 6000)];
    };
    const off = onWalletChanged(refresh);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchBalance(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { off(); document.removeEventListener('visibilitychange', onVisible); timers.forEach(clearTimeout); };
  }, [isDsa, fetchBalance]);

  if (!isDsa || balance === null || balance >= LOW_BALANCE_THRESHOLD) {
    return null;
  }

  return (
    <div style={{
      background: 'var(--warning-bg)', borderBottom: '1px solid var(--warning)',
      padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10, fontSize: 12.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warning)', fontWeight: 600 }}>
        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        <span>
          Insufficient wallet balance ({balance} credit{balance === 1 ? '' : 's'} left). Recharge now to avoid paid pulls (GST/ITR/Bank/Bureau/Salary OCR) failing mid-case.
        </span>
      </div>
      <button
        onClick={() => navigate('/wallet')}
        className="btn btn-primary btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 0, flexShrink: 0 }}
      >
        <Wallet size={13} /> Recharge Wallet
      </button>
    </div>
  );
};

export default LowWalletBalanceBanner;
