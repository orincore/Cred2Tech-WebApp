import React from 'react';
import { useTheme } from '../context/ThemeContext';

const DataTable = ({
  columns,
  data,
  loading = false,
  emptyState = null,
  onRowClick = null,
  rowKey = 'id',
  isMobile = false,
  stickyHeader = true,
  hoverRows = true,
  showLastRowBorder = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleRowClick = (row, e) => {
    if (onRowClick) {
      onRowClick(row, e);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--on-muted)', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return emptyState || (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '40px' }}>
        <div style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 16 }}>📋</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 6px' }}>No data found</h3>
        <p style={{ fontSize: 13, color: 'var(--on-muted)', margin: 0 }}>No items to display</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', width: '100%' }}>
      <table style={{ 
        width: isMobile ? '900px' : '100%', 
        borderCollapse: 'collapse', 
        tableLayout: 'auto', 
        minWidth: isMobile ? '900px' : '100%' 
      }}>
        <colgroup>
          {columns.map((col, idx) => (
            <col key={idx} style={{ width: col.width || 'auto' }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ 
            background: 'var(--bg)', 
            borderBottom: '2px solid var(--outline)', 
            position: stickyHeader ? 'sticky' : 'static', 
            top: 0, 
            zIndex: 10 
          }}>
            {columns.map((col) => (
              <th 
                key={col.key}
                style={{
                  padding: '11px 10px', 
                  fontSize: 10, 
                  fontWeight: 800, 
                  color: 'var(--on-muted)',
                  textTransform: 'uppercase', 
                  letterSpacing: '0.1em',
                  textAlign: col.align || 'left',
                  overflow: 'hidden', 
                  whiteSpace: 'nowrap', 
                  textOverflow: 'ellipsis'
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const isLast = idx === data.length - 1;
            return (
              <tr
                key={row[rowKey] || idx}
                onClick={(e) => handleRowClick(row, e)}
                style={{ 
                  borderBottom: (showLastRowBorder || !isLast) ? '1px solid var(--outline)' : 'none', 
                  background: 'var(--bg)', 
                  transition: 'background 0.12s',
                  cursor: onRowClick ? 'pointer' : 'default'
                }}
                onMouseEnter={hoverRows ? (e) => e.currentTarget.style.background = 'var(--surface)' : undefined}
                onMouseLeave={hoverRows ? (e) => e.currentTarget.style.background = 'var(--bg)' : undefined}
              >
                {columns.map((col) => (
                  <td 
                    key={col.key}
                    style={{
                      padding: col.padding || '14px 10px',
                      textAlign: col.align || 'left',
                      overflow: col.overflow || 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: col.whiteSpace || 'nowrap',
                    }}
                  >
                    {col.render ? col.render(row, idx) : row[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
