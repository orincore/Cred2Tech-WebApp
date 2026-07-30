import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileText, Download } from 'lucide-react';
import { msmeApi } from '../../api/msmeService';
import { listDocuments, downloadDocument } from '../../api/documentHelper';
import SectionCard from '../../components/ui/SectionCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import TravelingBorderButton from '../../components/TravelingBorderButton';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MsmeDocumentsPage = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.title = 'Cred2Tech | My Documents';
    (async () => {
      try {
        setLoading(true);
        // Documents live per case, but this page is a vault across every case
        // the customer has — pull each case's customer_id and fetch by that
        // instead, so it covers every case rather than needing one caseId.
        const { cases } = await msmeApi.getCases();
        const customerIds = [...new Set((cases || []).map(c => c.customer_id).filter(Boolean))];

        const docLists = await Promise.all(customerIds.map(customerId => listDocuments({ customerId })));
        const merged = docLists.flat();
        merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setDocuments(merged);
      } catch (err) {
        toast.error('Failed to load your documents');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    try {
      await downloadDocument(doc.id, doc.original_file_name);
    } catch (err) {
      toast.error('Failed to download document');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <LoadingSpinner size={40} fullPage />
      </div>
    );
  }

  return (
    <div className="msme-documents-page hide-scrollbar" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: isMobile ? 16 : 24 }}>
      <style>{`
        .msme-documents-page .card,
        .msme-documents-page .btn,
        .msme-documents-page .form-control,
        .msme-documents-page .badge { border-radius: 0 !important; }
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          MSME Portal
        </p>
        <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>My Documents</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
          {documents.length} document{documents.length === 1 ? '' : 's'} across all your cases, oldest to newest submitted first.
        </p>
      </div>

      {documents.length === 0 ? (
        <SectionCard delay={0.05}>
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Documents you upload, and reports we generate for your cases, will appear here."
            action={
              <TravelingBorderButton size="sm" onClick={() => navigate('/msme/dashboard')} className="rounded-none">
                Return to Dashboard
              </TravelingBorderButton>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard title="All Documents" subtitle="Everything you've submitted, plus reports we've generated for your cases" delay={0.05}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {documents.map((doc, i) => (
              <div key={doc.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: i < documents.length - 1 ? '1px solid var(--outline)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <FileText size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: 'break-word' }}>{doc.original_file_name || doc.file_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {doc.case_id ? `CASE-${doc.case_id} · ` : ''}{formatDate(doc.created_at)}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flexShrink: 0 }}
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                >
                  <Download size={13} /> {downloadingId === doc.id ? '...' : 'Download'}
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default MsmeDocumentsPage;
