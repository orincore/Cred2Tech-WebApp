import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'Nothing here',
  description = 'No data available.',
  action,
}) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    gap: 12,
    textAlign: 'center',
  }}>
    <div style={{
      width: 60,
      height: 60,
      borderRadius: '50%',
      background: 'var(--bg-elevated)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    }}>
      <Icon size={26} color="var(--text-tertiary)" />
    </div>
    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', maxWidth: 320 }}>{description}</p>
    {action && <div style={{ marginTop: 8 }}>{action}</div>}
  </div>
);

export default EmptyState;
