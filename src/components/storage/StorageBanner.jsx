import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDrive, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../api/storageService';

// Same cadence as the wallet / Virtual Workspace banners.
const POLL_MS = 5 * 60 * 1000;
const DSA_ROLES = ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];

/**
 * Site-wide warning (rendered once in AppLayout, beside the wallet banner) when
 * the account's storage is 80%+ full, so nobody finds out only when a pull or an
 * upload is refused. Hidden entirely while there is plenty of room.
 */
const StorageBanner = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const isDsa = hasRole(DSA_ROLES);

  const load = useCallback(async () => {
    if (!isDsa) return;
    try { setS(await storageService.status()); } catch { /* non-fatal — banner stays hidden */ }
  }, [isDsa]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!isDsa || !s || !s.applies || s.level === 'ok') return null;

  const full = s.is_full;
  const danger = full || s.level === 'critical';
  return (
    <div style={{
      background: danger ? 'var(--error-bg)' : 'var(--warning-bg)',
      borderBottom: `1px solid ${danger ? 'var(--error)' : 'var(--warning)'}`,
      padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10, fontSize: 12.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: danger ? 'var(--error)' : 'var(--warning)', fontWeight: 600 }}>
        {full ? <AlertTriangle size={16} style={{ flexShrink: 0 }} /> : <HardDrive size={16} style={{ flexShrink: 0 }} />}
        <span>
          {full
            ? `Storage is full (${s.used_gb} of ${s.limit_gb} GB). New GST, ITR, bank and bureau pulls and new uploads are paused.`
            : `Storage is ${Math.floor(s.percent)}% full (${s.used_gb} of ${s.limit_gb} GB).`}
        </span>
      </div>
      <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate('/profile?tab=storage')}>
        Manage storage
      </button>
    </div>
  );
};

export default StorageBanner;
