import React from 'react';
import { X, Factory, Briefcase, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CustomerTypeModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSelectMSME = () => {
    onClose();
    navigate('/customers/add');
  };

  const handleSelectSalaried = () => {
    onClose();
    navigate('/customers/salaried/add');
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 560, width: '96vw', borderRadius: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Add New Customer</h2>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>Select the customer type to begin the right journey</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div
            onClick={handleSelectMSME}
            style={{ border: '2px solid var(--border)', borderRadius: 0, padding: '22px 20px', cursor: 'pointer', transition: 'all 0.2s', background: 'var(--bg-elevated)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-subtle)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 0, background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Factory size={22} color="var(--primary)" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>MSME / Business</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Self-employed, business owners, proprietorships, partnerships, LLPs &amp; Pvt Ltd companies
            </div>
            <div style={{ marginTop: 14, fontSize: 11, fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              GST · ITR · Bank Statement <ArrowRight size={12} />
            </div>
          </div>

          <div
            onClick={handleSelectSalaried}
            style={{ border: '2px solid var(--border)', borderRadius: 0, padding: '22px 20px', cursor: 'pointer', transition: 'all 0.2s', background: 'var(--bg-elevated)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--success)'; e.currentTarget.style.background = 'var(--success-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 0, background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Briefcase size={22} color="var(--success)" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Salaried Individual</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Employees with regular salary income — Home Loan, LAP or Personal Loan
            </div>
            <div style={{ marginTop: 14, fontSize: 11, fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              Salary Slips · OCR · Eligibility <ArrowRight size={12} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerTypeModal;
