import React from 'react';
import { getInitials } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

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
const formatRole = (r) => {
  const roleName = typeof r === 'object' ? (r?.name || r?.id || 'Member') : (r || 'Member');
  return roleName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// ─── Org Node Card (reusable with dark/light mode support) ──────
const OrgCard = ({ 
  node, 
  selected, 
  onClick, 
  navigate, 
  expanded = new Set(), 
  onToggle, 
  originalChildCount = 0,
  width = 230,
  height = 130,
  showViewProfile = true,
  showReports = true,
  style = {}
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const color = roleColor(node.role);
  const isSelected = selected?.id === node.id;
  const initials = getInitials(node.name);
  const hasChildren = originalChildCount > 0;
  const isExpanded = expanded.has(node.id);
  const isCollapsed = hasChildren && !isExpanded;

  // Theme-aware colors
  const bgColor = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? (isSelected ? color : '#334155') : (isSelected ? color : '#e2e8f0');
  const borderHoverColor = isDark ? '#475569' : '#cbd5e1';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subtitleColor = 'var(--on-muted)';
  const roleLabelColor = 'var(--on-muted)';
  const expandBtnBg = isDark ? '#1e293b' : '#ffffff';
  const expandBtnBorder = isDark ? '#475569' : '#e2e8f0';
  const expandBtnColor = 'var(--on-muted)';
  const dividerColor = isDark ? '#334155' : '#f1f5f9';
  const viewProfileColor = '#4f46e5';
  const viewProfileBg = isDark ? '#1e1b4b' : '#f8f7ff';
  const viewProfileBorder = isDark ? '#4338ca' : '#e0e0fa';

  return (
    <foreignObject x={node.x - width / 2} y={node.y} width={width} height={height} style={{ overflow: 'visible' }}>
      <div
        onClick={(e) => { e.stopPropagation(); onClick(node); }}
        style={{
          width: width,
          background: bgColor,
          border: isSelected ? `2px solid ${color}` : `1px solid ${borderColor}`,
          borderRadius: 12,
          padding: '14px 14px 10px',
          cursor: 'pointer',
          boxSizing: 'border-box',
          boxShadow: isSelected
            ? `0 0 0 3px ${color}25, 0 4px 16px rgba(0,0,0,${isDark ? '0.3' : '0.12'})`
            : `0 1px 3px rgba(0,0,0,${isDark ? '0.2' : '0.08'}), 0 1px 8px rgba(0,0,0,${isDark ? '0.15' : '0.04'})`,
          transition: 'box-shadow 0.15s, border-color 0.15s, background 0.15s',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          fontFamily: "'Inter', sans-serif",
          userSelect: 'none',
          position: 'relative',
          ...style
        }}
        onMouseEnter={(e) => { 
          if (!isSelected) { 
            e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,${isDark ? '0.3' : '0.14'})`; 
            e.currentTarget.style.borderColor = borderHoverColor; 
          } 
        }}
        onMouseLeave={(e) => { 
          if (!isSelected) { 
            e.currentTarget.style.boxShadow = `0 1px 3px rgba(0,0,0,${isDark ? '0.2' : '0.08'}), 0 1px 8px rgba(0,0,0,${isDark ? '0.15' : '0.04'})`; 
            e.currentTarget.style.borderColor = borderColor; 
          } 
        }}
      >
        {/* Expand/Collapse button at bottom center */}
        {hasChildren && onToggle && (
          <div
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            style={{
              position: 'absolute',
              bottom: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: expandBtnBg,
              border: `1px solid ${expandBtnBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 14,
              color: expandBtnColor,
              boxShadow: `0 1px 3px rgba(0,0,0,${isDark ? '0.3' : '0.08'})`,
              zIndex: 10,
            }}
          >
            {isCollapsed ? '+' : '−'}
          </div>
        )}

        {/* Top: avatar + code label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: roleBg(node.role),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color,
            flexShrink: 0, border: `1.5px solid ${color}30`,
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: roleLabelColor, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {formatRole(node.role).split(' ')[0]}
          </span>
        </div>

        {/* Name */}
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textColor, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </p>
        {/* Subtitle: email or designation */}
        <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 500, color: subtitleColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.designation || node.email}
        </p>

        {/* Bottom action row */}
        {(showReports || showViewProfile) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${dividerColor}` }}>
            {showReports && (
              <span style={{ fontSize: 11, fontWeight: 500, color: subtitleColor, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 10 }}>•</span> {originalChildCount} reports
              </span>
            )}
            {showViewProfile && navigate && (
              <span
                style={{ 
                  marginLeft: 'auto', 
                  fontSize: 11, 
                  fontWeight: 600, 
                  color: viewProfileColor, 
                  cursor: 'pointer', 
                  background: viewProfileBg, 
                  padding: '3px 10px', 
                  borderRadius: 6, 
                  border: `1px solid ${viewProfileBorder}`, 
                  whiteSpace: 'nowrap' 
                }}
                onClick={(e) => { e.stopPropagation(); navigate(`/users/${node.id}`); }}
              >
                View profile
              </span>
            )}
          </div>
        )}
      </div>
    </foreignObject>
  );
};

export default OrgCard;
