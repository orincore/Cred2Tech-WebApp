import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SubDsaPayoutSetup from '../components/users/SubDsaPayoutSetup';
import { getUserById } from '../api/userService';
import { getTenantLenders } from '../api/tenantLenderService';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

/**
 * Full-screen page (not an inline dropdown on the Sub-DSA list) so the
 * payout-config form — several multi-column tables (overrides/slabs/
 * schemes) — has room to breathe and doesn't need to be shoehorned into a
 * card on a small phone screen.
 */
const SubDsaPayoutSetupPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [partner, setPartner] = useState(null);
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUserById(id), getTenantLenders()])
      .then(([userData, lenderData]) => {
        const u = userData.user || userData;
        setPartner(u);
        setLenders(Array.isArray(lenderData) ? lenderData : lenderData?.lenders || []);
      })
      .catch(() => {
        toast.error('Failed to load Sub-DSA partner');
        navigate('/users');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div style={{ padding: 60 }}><LoadingSpinner fullPage /></div>;
  if (!partner) return null;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', color: 'var(--on-surface)' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', maxWidth: 1000, margin: '0 auto' }}>
        <PageHeader
          title={`Payout Setup — ${partner.name}`}
          subtitle="Configure how much of the DSA's commission this Sub-DSA partner earns."
          breadcrumbs={[{ label: 'Team Management', path: '/users' }, { label: partner.name }]}
          compact={isMobile}
        />
      </div>
      <div style={{ padding: isMobile ? '0 16px 16px' : '0 24px 24px', maxWidth: 1000, margin: '0 auto' }}>
        <div className="card" style={{ padding: 0, borderRadius: 0 }}>
          <SubDsaPayoutSetup userId={partner.id} lenders={lenders} />
        </div>
      </div>
    </div>
  );
};

export default SubDsaPayoutSetupPage;
