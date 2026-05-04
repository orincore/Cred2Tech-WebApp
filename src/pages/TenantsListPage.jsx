import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Eye, Edit, Building, RefreshCw, X, MapPin, Hash, Wallet, Activity } from 'lucide-react';
import { getTenants, getTenantSummary } from '../api/tenantService';
import { MOCK_TENANTS } from '../constants/mockData';
import { STATUS_OPTIONS } from '../constants/roles';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDate } from '../utils/helpers';

const TenantsListPage = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTenants();
      setTenants(Array.isArray(data) ? data : data.tenants || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load DSAs.');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const openSummary = async (id) => {
    setSelectedTenantId(id);
    setSummaryData(null);
    setLoadingSummary(true);
    try {
      const data = await getTenantSummary(id);
      setSummaryData(data);
    } catch (err) {
      console.error('Failed to load summary', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        String(t.name).toLowerCase().includes(q) ||
        String(t.pan_number || '').toLowerCase().includes(q);
      const matchType = !filterType || t.type === filterType;
      const matchStatus = !filterStatus || t.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [tenants, search, filterType, filterStatus]);

  const SelectFilter = ({ value, onChange, options, placeholder }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="form-control" style={{ width: 'auto', minWidth: 130 }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  );

  return (
    <div>
      <PageHeader
        title="Manage DSAs"
        subtitle="All registered DSA entities"
        breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Manage DSA' }]}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/tenants/create')}>
            <Building size={15} /> Create DSA
          </button>
        }
      />

      {error && (
        <div className="notice notice-warning" style={{ marginBottom: 20 }}>
          <RefreshCw size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="card card-padded" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by DSA name or PAN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={15} color="var(--text-tertiary)" />
            <SelectFilter value={filterType} onChange={setFilterType} options={['DSA', 'INTERNAL']} placeholder="All Types" />
            <SelectFilter value={filterStatus} onChange={setFilterStatus} options={STATUS_OPTIONS} placeholder="All Status" />
            {(search || filterType || filterStatus) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card" style={{ padding: 48 }}><LoadingSpinner fullPage /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No DSAs found"
            description="Try adjusting your search or filters, or create a new DSA."
            action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/tenants/create')}><Building size={14} /> Create DSA</button>}
          />
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>DSA NAME</th>
                <th>PAN</th>
                <th>CITY</th>
                <th>WALLET</th>
                <th>API CALLS (MTD)</th>
                <th>LEAD SUB</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => openSummary(t.id)} style={{ cursor: 'pointer' }} className="hover-row">
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '6px',
                        background: 'var(--primary-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--primary)', flexShrink: 0
                      }}>
                        <Building size={16} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)', margin: 0 }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                          {t.city} · Since {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>{t.pan_number || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t.city || '—'}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: (t.wallet_balance || 0) < 500 ? '#C53030' : '#2F855A', fontSize: 13 }}>
                      ₹{Number(t.wallet_balance || 0).toLocaleString()}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, textAlign: 'center' }}>
                    {t.api_calls_mtd || 0}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: t.type === 'DSA' ? '#2F855A' : '#718096',
                      background: t.type === 'DSA' ? '#F0FFF4' : '#EDF2F7',
                      padding: '2px 8px', borderRadius: 4
                    }}>
                      {t.type === 'DSA' ? 'Active' : 'None'}
                    </span>
                  </td>
                  <td><Badge type="status" value={t.status} /></td>
                  <td>
                    <button className="btn btn-outline btn-xs" style={{ fontSize: 11, padding: '2px 10px' }} onClick={(e) => { e.stopPropagation(); openSummary(t.id); }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-out Drawer for DSA Summary */}
      {selectedTenantId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }} onClick={() => setSelectedTenantId(null)}>
          <div style={{ background: '#fff', width: '500px', height: '100%', padding: '24px', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', overflowY: 'auto', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Building size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{summaryData?.tenant_name || 'DSA Details'}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Detailed analytics and profile</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedTenantId(null)}>
                <X size={20} />
              </button>
            </div>

            {loadingSummary ? (
              <div style={{ padding: 40, textAlign: 'center' }}><LoadingSpinner /></div>
            ) : summaryData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card" style={{ padding: 20, background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: '0 0 4px 0' }}>Wallet Balance</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>₹{Number(summaryData.wallet_balance).toLocaleString()}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: '0 0 4px 0' }}>Total API Calls</p>
                      <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{summaryData.total_api_usage}</p>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px 0', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Profile</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 2px 0' }}>PAN</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{summaryData.pan_number || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 2px 0' }}>GSTIN</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{summaryData.gst_number || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 2px 0' }}>Phone</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{summaryData.mobile || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 2px 0' }}>Email</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{summaryData.email || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 2px 0' }}>City</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{summaryData.city || '—'}</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Activity size={16} color="var(--primary)" />
                      <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Activity (MTD)</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ITR Calls</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{summaryData.itr_pulls}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>GST Calls</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{summaryData.gst_pulls}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Bureau Pulls</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{summaryData.bureau_pulls}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Building size={16} color="var(--primary)" />
                      <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Portfolio</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Customers</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{summaryData.total_customers}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Cases</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{summaryData.total_cases}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Team Size</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{summaryData.team_size}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Recent Wallet Activity</h4>
                  </div>
                  {summaryData.recent_wallet_transactions?.length > 0 ? (
                    <table style={{ margin: 0, border: 'none' }}>
                      <tbody style={{ border: 'none' }}>
                        {summaryData.recent_wallet_transactions.map(tx => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 16px', fontSize: 12 }}>
                              <p style={{ margin: 0, fontWeight: 500 }}>{tx.remarks || tx.api_code || 'Wallet Update'}</p>
                              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-tertiary)' }}>{formatDate(tx.created_at)}</p>
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: tx.transaction_type === 'CREDIT' ? 'var(--success)' : 'var(--error)' }}>
                              {tx.transaction_type === 'CREDIT' ? '+' : '-'} {tx.amount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No recent transactions</div>
                  )}
                </div>

              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Failed to load DSA metrics.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default TenantsListPage;
