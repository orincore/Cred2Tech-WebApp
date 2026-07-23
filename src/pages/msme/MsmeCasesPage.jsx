import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import EmptyState from '../../components/ui/EmptyState';
import TravelingBorderButton from '../../components/TravelingBorderButton';

const MsmeCasesPage = () => {
  const navigate = useNavigate();
  return (
    <div className="hide-scrollbar" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: 24 }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <SectionCard delay={0.05}>
          <EmptyState
            icon={FolderOpen}
            title="My Cases"
            description="You will be able to view your complete case history here soon."
            action={
              <TravelingBorderButton size="sm" onClick={() => navigate('/msme/dashboard')} className="rounded-none">
                Return to Dashboard
              </TravelingBorderButton>
            }
          />
        </SectionCard>
      </div>
    </div>
  );
};

export default MsmeCasesPage;
