import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Building2, Mail, Phone, MapPin, FileText, Banknote, Home,
  Users, CreditCard, Activity, Eye, Plus, ArrowLeft
} from 'lucide-react';
import { customerService } from '../api/customerService';
import api from '../api/axiosInstance';
import { viewDocument } from '../api/documentHelper';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useTheme } from '../context/ThemeContext';

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return { isMobile };
};

const formatCurrency = (val) => {
  if (!val) return null;
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(1)} Cr`;
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)}L`;
  return `₹${Number(val).toLocaleString('en-IN')}`;
};

const formatDate = (d) => {
  if (!d) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
};

const STAGE_COLORS = {
  LEAD_CREATED:         { light: ['#FEF3C7', '#92400E'], dark: ['#78350F', '#FDE68A'] },
  DATA_COLLECTION:      { light: ['#E0F2FE', '#0369A1'], dark: ['#0c4a6e', '#7dd3fc'] },
  LEAD_SENT_TO_LENDER:  { light: ['#F3E8FF', '#6B21A8'], dark: ['#4c1d95', '#d8b4fe'] },
  ESR_GENERATED:        { light: ['#FFEDD5', '#C2410C'], dark: ['#7c2d12', '#fdba74'] },
  APPROVED:             { light: ['#D1FAE5', '#065F46'], dark: ['#064e3b', '#6ee7b7'] },
  DISBURSED:            { light: ['#DCFCE7', '#166534'], dark: ['#14532d', '#86efac'] },
  PARTLY_DISBURSED:     { light: ['#D1FAE5', '#065F46'], dark: ['#064e3b', '#6ee7b7'] },
  CLOSED:               { light: ['#F3F4F6', '#374151'], dark: ['#1f2937', '#d1d5db'] },
  REJECTED:             { light: ['#FEE2E2', '#991B1B'], dark: ['#7f1d1d', '#fca5a5'] },
  DRAFT:                { light: ['#F3F4F6', '#6B7280'], dark: ['#1f2937', '#9ca3af'] },
};
const STAGE_LABELS = {
  LEAD_CREATED: 'Lead Created', DATA_COLLECTION: 'Data Pulled', LEAD_SENT_TO_LENDER: 'Lead Sent',
  ESR_GENERATED: 'ESR Generated', APPROVED: 'Sanctioned', DISBURSED: 'Disbursed',
  PARTLY_DISBURSED: 'Partly Disbursed', CLOSED: 'Closed', REJECTED: 'Rejected', DRAFT: 'Draft',
};

const getCibilColor = (score, isDark) => {
  if (!score) return isDark ? '#64748b' : '#9CA3AF';
  if (score >= 700) return isDark ? '#6ee7b7' : '#10B981';
  if (score >= 650) return isDark ? '#fcd34d' : '#F59E0B';
  return isDark ? '#fca5a5' : '#EF4444';
};

const StatusPill = ({ status }) => {
  const s = (status || '').toUpperCase();
  const [bg, color] = s === 'COMPLETE' || s === 'ACTIVE' || s === 'VERIFIED'
    ? ['var(--success-bg)', 'var(--success)']
    : s === 'PENDING'
      ? ['var(--warning-bg)', 'var(--warning)']
      : ['var(--bg-elevated)', 'var(--text-tertiary)'];
  return <span style={{ background: bg, color, padding: '3px 10px', borderRadius: 0, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{status || 'NOT STARTED'}</span>;
};

const Detail = ({ icon: Icon, label, value }) => (
  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
    <div style={{ width: 32, height: 32, borderRadius: 0, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={15} color="var(--text-tertiary)" />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 500, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', wordBreak: 'break-word' }}>{value || '—'}</p>
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{title}</p>
    <div>{children}</div>
  </div>
);

const EmptyRow = ({ icon: Icon, text }) => (
  <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-tertiary)' }}>
    <Icon size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
    <div style={{ fontSize: 13 }}>{text}</div>
  </div>
);

const TABS = ['Overview', 'Documents', 'Cases', 'Co-Borrowers'];

const CustomerProfilePage = () => {
  const { customer_id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [profile, setProfile] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [profRaw, availRaw] = await Promise.all([
          customerService.getCustomerProfile(customer_id),
          customerService.getApiAvailability(customer_id)
        ]);
        setProfile(profRaw);
        setAvailability(availRaw);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [customer_id]);

  const primaryBureau = profile?.bureau_summary?.find(b => b.applicant_type === 'PRIMARY');
  const latestCaseId = profile?.cases?.[0]?.id || null;

  const handleFetchBureau = async (applicantId = null) => {
    if (!latestCaseId) return toast.error('No active case found to run Bureau checks on.');
    try {
      setLoading(true);
      const res = await api.post(`/verification/bureau/run/${latestCaseId}`, { applicantId });
      if (res.data.status === 'SUCCESS' || res.data.status === 'PARTIAL_SUCCESS') window.location.reload();
      else toast.error('Bureau fetch did not complete for any applicant.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Bureau fetch failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingSpinner size={36} />
    </div>
  );
  if (!profile) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Failed to load customer profile.</p>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')}><ArrowLeft size={14} /> Back to Pipeline</button>
    </div>
  );

  const latestCase = profile.cases?.[0];

  return (
    <div className="customer-profile-page hide-scrollbar" style={{ height: '100%', overflowY: 'auto', padding: '24px 20px' }}>
      <style>{`
        .customer-profile-page .card,
        .customer-profile-page .btn {
          border-radius: 0 !important;
        }
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <PageHeader
        title={profile.customer_name}
        subtitle={[profile.entity_type, profile.industry, profile.gstin ? `GSTIN: ${profile.gstin}` : null].filter(Boolean).join(' · ')}
        breadcrumbs={[{ label: 'Pipeline', path: '/customers' }, { label: profile.customer_name }]}
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')}>
              <ArrowLeft size={14} /> Back
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/customers/add')}>
              <Plus size={14} /> New Case
            </button>
          </>
        }
      />

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard title="Bureau Score" value={primaryBureau?.cibil_score || '—'} subtitle="Primary applicant" icon={CreditCard} color="var(--primary)" />
        <StatCard title="Total Cases" value={profile.cases?.length || 0} subtitle="All time" icon={Building2} color="#0284C7" />
        <StatCard title="Documents" value={profile.documents?.length || 0} subtitle="Uploaded" icon={FileText} color="#059669" />
        <StatCard title="Bureau Status" value={profile.api_status?.bureau || 'PENDING'} subtitle="Data pull" icon={Activity} color="#F59E0B" />
      </div>

      <div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="hide-scrollbar" style={{ display: 'flex', borderBottom: '2px solid var(--border)', overflowX: 'auto', overflowY: 'hidden' }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '14px 20px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
                  color: activeTab === tab ? 'var(--primary)' : 'var(--text-tertiary)',
                  borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -2, whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'color 0.15s',
                }}
              >
                {tab}
                {tab === 'Documents' && profile.documents?.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>({profile.documents.length})</span>}
                {tab === 'Cases' && profile.cases?.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>({profile.cases.length})</span>}
                {tab === 'Co-Borrowers' && profile.bureau_summary?.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>({profile.bureau_summary.length})</span>}
              </button>
            ))}
          </div>

          <div style={{ padding: 24 }}>
            {activeTab === 'Overview' && (
              <>
                <Section title="Business Details">
                  <Detail icon={Building2} label="Entity Type" value={profile.entity_type} />
                  <Detail icon={Building2} label="Industry" value={profile.industry} />
                  <Detail icon={Building2} label="Vintage" value={profile.business_vintage ? `${profile.business_vintage} years` : null} />
                  <Detail icon={MapPin} label="Address" value={[profile.principal_address, profile.principal_city, profile.principal_state, profile.principal_pincode].filter(Boolean).join(', ')} />
                  <Detail icon={Mail} label="Email" value={profile.business_email} />
                  <Detail icon={Phone} label="Mobile" value={profile.business_mobile} />
                </Section>

                <Section title="Income Summary">
                  <Detail icon={Banknote} label="GST Turnover (Avg 12M)" value={profile.income_summary?.gst_turnover_avg_12m} />
                  <Detail icon={Banknote} label="ITR Net Income" value={profile.income_summary?.itr_net_income} />
                  <Detail icon={Banknote} label="Bank Avg Monthly Credit" value={profile.income_summary?.bank_avg_monthly_credit} />
                  <Detail icon={Banknote} label="FOIR (Est.)" value={profile.income_summary?.foir} />
                  <Detail icon={Banknote} label="Last Updated" value={formatDate(profile.income_summary?.last_updated)} />
                </Section>

                <Section title="Property & Collateral">
                  <Detail icon={Home} label="Property Type" value={latestCase?.property_type} />
                  <Detail icon={MapPin} label="Location" value={latestCase?.location} />
                  <Detail icon={Home} label="Market Value" value={formatCurrency(latestCase?.property_value)} />
                  <Detail icon={Home} label="Ownership" value={latestCase?.ownership_type} />
                  <Detail icon={Home} label="Encumbrance" value={latestCase?.encumbrance} />
                </Section>
              </>
            )}

            {activeTab === 'Documents' && (
              !profile.documents?.length ? <EmptyRow icon={FileText} text="No documents uploaded yet." /> :
              isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {profile.documents.map(doc => (
                    <div key={doc.id} style={{ border: '1px solid var(--border)', borderRadius: 0, padding: 14 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{doc.document_type?.replace(/_/g, ' ')}</div>
                      {doc.original_file_name && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>{doc.original_file_name}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(doc.created_at) || '—'}</span>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            viewDocument(doc.id).catch(() => toast.error('Failed to open document'));
                          }}
                        >
                          <Eye size={13} /> View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <colgroup><col style={{ width: '38%' }} /><col style={{ width: '18%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} /><col style={{ width: '12%' }} /></colgroup>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Document', 'Applicant', 'Status', 'Uploaded On', 'Action'].map(h => (
                        <th key={h} style={{ padding: '10px 8px', fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profile.documents.map(doc => (
                      <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 8px', textAlign: 'center', wordBreak: 'break-word' }}>
                          <div style={{ fontWeight: 600 }}>{doc.document_type?.replace(/_/g, ' ')}</div>
                          {doc.original_file_name && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{doc.original_file_name}</div>}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>{profile.customer_name}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}><StatusPill status="COMPLETE" /></td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-tertiary)' }}>{formatDate(doc.created_at) || '—'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              viewDocument(doc.id).catch(() => toast.error('Failed to open document'));
                            }}
                          >
                            <Eye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'Cases' && (
              !profile.cases?.length ? <EmptyRow icon={Building2} text="No cases found for this customer." /> :
              isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {profile.cases.map(c => {
                    const colors = STAGE_COLORS[c.stage] || STAGE_COLORS.DRAFT;
                    const [bg, color] = isDark ? colors.dark : colors.light;
                    return (
                      <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 0, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>CASE-{c.id}</span>
                          <span style={{ background: bg, color, padding: '3px 10px', borderRadius: 0, fontSize: 10, fontWeight: 700 }}>{STAGE_LABELS[c.stage] || c.stage}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{c.lender_name || '—'} · {c.product_type || '—'}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{formatCurrency(c.loan_amount) || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(c.updated_at) || '—'}</div>
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cases/${c.id}`)}>View</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <colgroup><col style={{ width: '15%' }} /><col style={{ width: '25%' }} /><col style={{ width: '17%' }} /><col style={{ width: '18%' }} /><col style={{ width: '15%' }} /><col style={{ width: '10%' }} /></colgroup>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Case', 'Lender / Product', 'Amount', 'Stage', 'Last Updated', 'Action'].map(h => (
                        <th key={h} style={{ padding: '10px 8px', fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profile.cases.map(c => {
                      const colors = STAGE_COLORS[c.stage] || STAGE_COLORS.DRAFT;
                      const [bg, color] = isDark ? colors.dark : colors.light;
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>CASE-{c.id}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', wordBreak: 'break-word' }}>
                            <div>{c.lender_name || '—'}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.product_type || '—'}</div>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600 }}>{formatCurrency(c.loan_amount) || '—'}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <span style={{ background: bg, color, padding: '3px 10px', borderRadius: 0, fontSize: 10, fontWeight: 700 }}>{STAGE_LABELS[c.stage] || c.stage}</span>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-tertiary)' }}>{formatDate(c.updated_at) || '—'}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cases/${c.id}`)}>View</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'Co-Borrowers' && (
              !profile.bureau_summary?.length ? <EmptyRow icon={Users} text="No co-applicants / directors found." /> :
              isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {profile.bureau_summary.map(b => (
                    <div key={b.applicant_id} style={{ border: '1px solid var(--border)', borderRadius: 0, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{b.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{b.applicant_type === 'PRIMARY' ? 'Primary' : 'Co-Applicant'} · {b.pan_masked || '—'} · {b.mobile || '—'}</div>
                        </div>
                        <span style={{ fontWeight: 800, color: getCibilColor(b.cibil_score, isDark) }}>{b.cibil_score || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        <span>Loans: {b.active_loan_count ?? '—'}</span>
                        <span>EMI: {b.emi_obligations_total ? `₹${Number(b.emi_obligations_total).toLocaleString('en-IN')}` : '—'}</span>
                        <span style={{ color: b.overdue_amount ? 'var(--error)' : 'var(--success)' }}>
                          Overdue: {b.overdue_amount ? `₹${Number(b.overdue_amount).toLocaleString('en-IN')}` : 'Nil'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {b.bureau_fetched ? <StatusPill status="Verified" /> : <StatusPill status="Pending" />}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleFetchBureau(b.applicant_id)}
                          disabled={b.bureau_fetched || !availability?.can_pull_bureau}
                        >
                          {b.bureau_fetched ? 'Pulled' : 'Run Bureau'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <colgroup><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '10%' }} /><col style={{ width: '22%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /></colgroup>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Applicant', 'PAN / Mobile', 'Bureau Score', 'Loans / EMI / Overdue', 'Status', 'Action'].map(h => (
                        <th key={h} style={{ padding: '10px 8px', fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profile.bureau_summary.map(b => (
                      <tr key={b.applicant_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 600 }}>{b.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{b.applicant_type === 'PRIMARY' ? 'Primary' : 'Co-Applicant'}</div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', wordBreak: 'break-word' }}>
                          <div>{b.pan_masked || '—'}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{b.mobile || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, color: getCibilColor(b.cibil_score, isDark) }}>{b.cibil_score || '—'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: 11 }}>
                          <div>Loans: {b.active_loan_count ?? '—'}</div>
                          <div style={{ marginTop: 2 }}>EMI: {b.emi_obligations_total ? `₹${Number(b.emi_obligations_total).toLocaleString('en-IN')}` : '—'}</div>
                          <div style={{ marginTop: 2, color: b.overdue_amount ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>
                            Overdue: {b.overdue_amount ? `₹${Number(b.overdue_amount).toLocaleString('en-IN')}` : 'Nil'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {b.bureau_fetched ? <StatusPill status="Verified" /> : <StatusPill status="Pending" />}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleFetchBureau(b.applicant_id)}
                            disabled={b.bureau_fetched || !availability?.can_pull_bureau}
                          >
                            {b.bureau_fetched ? 'Pulled' : 'Run Bureau'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      </div>

      {/* Historical Activity — full width, bottom of page */}
      <div className="card card-padded" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Historical Activity</h3>
        {!profile.activity_log?.length ? (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No activity yet</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px 32px' }}>
            {profile.activity_log.map((log, i) => (
              <div key={i} style={{ paddingLeft: 14, borderLeft: '2px solid var(--primary-subtle)' }}>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{new Date(log.timestamp).toLocaleString()}</p>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{log.activity_type?.replace(/_/g, ' ')}</p>
                {log.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{log.description}</p>}
                {log.performed_by && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>by {log.performed_by}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerProfilePage;
