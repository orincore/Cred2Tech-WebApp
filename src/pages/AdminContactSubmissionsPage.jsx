import React, { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import ContactRequestsTab from './ContactRequestsTab';
import DemoRequestsTab from './DemoRequestsTab';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

const TABS = [
  { key: 'contact', label: 'Contact Requests' },
  { key: 'demo', label: 'Demo Requests' },
];

// Both leads sources from the public marketing site — kept as tabs on one
// page (mirroring AdminTicketsListPage's Tickets/Case Feedback tabs) rather
// than two separate nav entries, since they're the same audience (sales)
// reviewing the same kind of inbound lead.
const AdminContactSubmissionsPage = () => {
  const { isMobile } = useResponsive();
  const [activeTab, setActiveTab] = useState('contact');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <PageHeader
          title={activeTab === 'contact' ? 'Contact Requests' : 'Demo Requests'}
          subtitle={activeTab === 'contact'
            ? "Leads submitted through the Cred2Tech website's Contact Us form."
            : "Leads submitted through the Cred2Tech website's Request Demo form."}
          compact={isMobile}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 0,
                border: `1px solid ${activeTab === tab.key ? 'var(--primary)' : 'var(--outline)'}`,
                borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '1px solid var(--outline)',
                background: activeTab === tab.key ? 'var(--primary)0f' : 'var(--surface)',
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>
        {activeTab === 'contact' ? <ContactRequestsTab /> : <DemoRequestsTab />}
      </div>
    </div>
  );
};

export default AdminContactSubmissionsPage;
