import React from 'react';
import { X } from 'lucide-react';
import { getInitials } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import TravelingBorderButton from './TravelingBorderButton';

// ─── Role colors ──────────────────────────────────────────────
const roleColor = (role) => {
  if (!role) return '#64748b';
  const r = typeof role === 'object' ? (role?.name || role?.id || '') : role;
  const upper = (r || '').toUpperCase();
  if (upper.includes('SUPER')) return '#7c3aed';
  if (upper.includes('DSA_ADMIN') || upper.includes('ADMIN')) return '#4f46e5';
  if (upper.includes('MEMBER') || upper.includes('EMPLOYEE')) return '#0891b2';
  if (upper.includes('DSA')) return '#f59e0b';
  return '#64748b';
};

const roleBg = (role) => roleColor(role) + '18';
const formatRoleText = (r) => (r?.name || r || 'Member').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ─── User Side Panel Component ───────────────────────────────
const UserSidePanel = ({ selected, onClose, navigate, children }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!selected) return null;

  const color = roleColor(selected.role);
  const initials = getInitials(selected.name);

  return (
    <div style={{ width: 320, borderLeft: '1px solid var(--outline)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      {/* Panel header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: roleBg(selected.role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: roleColor(selected.role), border: `2px solid ${roleColor(selected.role)}40`, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{selected.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--on-muted)' }}>{selected.email}</p>
        </div>
        <button 
          onClick={onClose}
          style={{ 
            width: 28, 
            height: 28, 
            border: '1px solid var(--outline)', 
            borderRadius: 6, 
            background: 'transparent', 
            cursor: 'pointer', 
            color: 'var(--on-muted)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexShrink: 0,
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#ef4444';
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.background = '#fef2f2';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--outline)';
            e.currentTarget.style.color = 'var(--on-muted)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Info rows */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Role', formatRoleText(selected.role)],
          ['Status', selected.status || 'ACTIVE'],
          ['Mobile', selected.mobile || '—'],
          ['Hierarchy Level', selected.hierarchy_level || 'Root'],
          ['Manager ID', selected.manager_id || 'None'],
          ['Designation', selected.designation || '—'],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{
              fontSize: 12, fontWeight: 600, color: label === 'Status' ? (val === 'ACTIVE' ? '#10b981' : '#f43f5e') : 'var(--on-surface)',
              background: label === 'Status' ? (val === 'ACTIVE' ? '#10b98118' : '#f43f5e18') : 'transparent',
              padding: label === 'Status' ? '2px 8px' : '0', borderRadius: 20,
            }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Direct reports */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>
            Direct Reports
          </p>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-muted)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--outline)' }}>
            {selected._children?.length || 0}
          </span>
        </div>
        {(!selected._children || selected._children.length === 0) ? (
          <p style={{ fontSize: 12, color: 'var(--on-muted)', margin: 0 }}>No direct reports</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selected._children.map((c) => (
              <div
                key={c.id}
                onClick={() => children?.onClickChild?.(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--outline)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = roleColor(c.role); e.currentTarget.style.background = 'var(--surface-low)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--outline)'; e.currentTarget.style.background = 'var(--bg)'; }}
              >
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: roleBg(c.role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: roleColor(c.role), flexShrink: 0 }}>
                  {getInitials(c.name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--on-muted)' }}>{formatRoleText(c.role)}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: c.status === 'ACTIVE' ? '#10b981' : '#f43f5e', background: c.status === 'ACTIVE' ? '#10b98118' : '#f43f5e18', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>
                  {c.status || 'ACTIVE'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* View profile button */}
        <div style={{ width: '100%', marginTop: 16 }}>
          <TravelingBorderButton
            onClick={() => navigate(`/users/${selected.id}`)}
            size="sm"
            solid
            showIcon={false}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            View Full Profile
          </TravelingBorderButton>
        </div>
      </div>
    </div>
  );
};

export default UserSidePanel;
