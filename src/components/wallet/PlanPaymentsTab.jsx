import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Download, Mail, CheckCircle2, Clock, Wallet, HardDrive, LayoutGrid } from 'lucide-react';
import api from '../../api/axiosInstance';
import DataTable from '../DataTable';
import EmptyState from '../ui/EmptyState';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const compactField = {
  border: '1px solid var(--outline)', borderRadius: 0, background: 'var(--surface)', color: 'var(--text-primary)',
  fontSize: 12, fontWeight: 600, padding: '6px 10px', outline: 'none',
};

const PRODUCT = {
  STORAGE: { label: 'Storage plan', icon: HardDrive, color: 'var(--primary)' },
  VIRTUAL_WORKSPACE: { label: 'Virtual Workspace', icon: LayoutGrid, color: 'var(--success)' },
};

const ProductBadge = ({ inv }) => {
  const p = PRODUCT[inv.product] || PRODUCT.VIRTUAL_WORKSPACE;
  const Icon = p.icon;
  return (
    <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: p.color, background: 'var(--bg-elevated)' }}>
      <Icon size={12} /> {p.label}
    </span>
  );
};

const EmailStatus = ({ inv }) => (inv.invoice_emailed_at
  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--success)' }}><CheckCircle2 size={12} /> Emailed</span>
  : <span title="We keep retrying automatically; you can also use Email me" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--warning)' }}><Clock size={12} /> Not emailed yet</span>);

/**
 * Wallet → Plan Payments. Subscription and storage-plan charges are paid straight
 * through Razorpay (card / UPI auto-debit), so they never appear as wallet
 * transactions or recharges. This lists each one with its GST split, lets the
 * admin download the tax invoice, and e-mail it to themselves again.
 */
const PlanPaymentsTab = ({ isMobile, initialRows = null }) => {
  // `initialRows` lets the tab render pre-loaded data (previews / tests); in the app it is
  // omitted and the rows are fetched on mount.
  const [rows, setRows] = useState(initialRows || []);
  const [loading, setLoading] = useState(!initialRows);
  const [downloadingId, setDownloadingId] = useState(null);
  const [emailingId, setEmailingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/virtual-workspace/subscription/invoices');
      setRows(res.data.invoices || []);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to load plan payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!initialRows) load(); }, [load, initialRows]);

  const download = async (inv) => {
    setDownloadingId(inv.id);
    try {
      const res = await api.get(`/virtual-workspace/subscription/invoices/${inv.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `${inv.invoice_number.replace(/\//g, '-')}.pdf`);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const emailIt = async (inv) => {
    setEmailingId(inv.id);
    try {
      const res = await api.post(`/virtual-workspace/subscription/invoices/${inv.id}/email`);
      toast.success(`Invoice ${inv.invoice_number} sent${res.data?.to ? ` to ${res.data.to}` : ''}`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err) || "We couldn't send the email right now");
    } finally {
      setEmailingId(null);
    }
  };

  const actions = (inv) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button onClick={() => download(inv)} disabled={downloadingId === inv.id} style={{ ...compactField, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: downloadingId === inv.id ? 'not-allowed' : 'pointer' }}>
        {downloadingId === inv.id ? <span className="skeleton-inline" style={{ width: 12, height: 12 }} /> : <Download size={12} />} Download
      </button>
      <button onClick={() => emailIt(inv)} disabled={emailingId === inv.id} title="Email this invoice to the address on your account" style={{ ...compactField, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: emailingId === inv.id ? 'not-allowed' : 'pointer' }}>
        {emailingId === inv.id ? <span className="skeleton-inline" style={{ width: 12, height: 12 }} /> : <Mail size={12} />} Email me
      </button>
    </div>
  );

  const columns = [
    { key: 'charged_at', label: 'Date', width: '15%', padding: '16px 12px', render: (i) => <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{formatDateTime(i.charged_at)}</span> },
    { key: 'product', label: 'Plan', width: '14%', padding: '16px 12px', render: (i) => <ProductBadge inv={i} /> },
    { key: 'description', label: 'Details', width: '20%', padding: '16px 12px', render: (i) => <span style={{ fontSize: 12, color: 'var(--on-surface)' }}>{i.description}</span> },
    {
      key: 'total', label: 'Amount Paid', align: 'right', width: '14%', padding: '16px 12px',
      render: (i) => (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>{inr(i.total_amount_inr)}</div>
          <div style={{ fontSize: 10, color: 'var(--on-muted)', marginTop: 2 }}>{inr(i.base_amount_inr)} + GST {inr(i.gst_amount_inr)}</div>
        </div>
      ),
    },
    { key: 'invoice_number', label: 'Invoice', width: '12%', padding: '16px 12px', render: (i) => <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--on-surface)' }}>{i.invoice_number}</span> },
    { key: 'email', label: 'Email', width: '11%', padding: '16px 12px', render: (i) => <EmailStatus inv={i} /> },
    { key: 'actions', label: '', width: '14%', padding: '16px 12px', render: (i) => actions(i) },
  ];

  return (
    <div className="card" style={{ padding: 0, borderRadius: 0, borderTop: 'none' }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--outline)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>Plan payments &amp; invoices</div>
        <div style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 3 }}>
          Virtual Workspace subscription and storage-plan charges, paid by card or UPI auto-debit (not from your wallet credits). Each one has a GST tax invoice.
        </div>
      </div>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-muted)', fontSize: 13 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Wallet} title="No plan payments yet" description="When you pay for a Virtual Workspace subscription or a storage plan, the payment and its GST invoice will appear here." />
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
          {rows.map((i) => (
            <div key={i.id} style={{ background: 'var(--surface)', border: '1px solid var(--outline)', padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <ProductBadge inv={i} />
                  <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 6 }}>{formatDateTime(i.charged_at)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--on-surface)' }}>{inr(i.total_amount_inr)}</div>
                  <div style={{ fontSize: 10, color: 'var(--on-muted)' }}>{inr(i.base_amount_inr)} + GST {inr(i.gst_amount_inr)}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--on-surface)', marginTop: 8 }}>{i.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--outline)' }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--on-surface)' }}>{i.invoice_number}</div>
                  <EmailStatus inv={i} />
                </div>
                {actions(i)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable columns={columns} data={rows} rowKey="id" />
      )}
    </div>
  );
};

export default PlanPaymentsTab;
