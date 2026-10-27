import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Search, User, Building2, CheckCircle2, Sparkles, MapPin } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDate, toTitleCase, resolveEntityName, maskPan } from '../utils/helpers';
import { roleLabel } from '../constants/roles';
import { getTenantSummary } from '../api/tenantService';
import CustomSelect from '../components/CustomSelect';
import {
  getDirectMsmeCaseDetail,
  getAllocationTargets,
  allocateDirectMsmeCase,
} from '../api/adminMsmeService';

// Same list DSARegisterPage.jsx / OrganizationProfilePage.jsx use for
// Operational States — kept local for the same reason as those pages'
// own copies (small, stable list, not worth a shared module).
const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

// Neighbouring / nearby states for each Indian state. A DSA that serves a
// neighbouring state is shown as "Suggested" (one tier below an exact-state
// "Recommended" match) so the admin can see nearby options without having to
// clear the state filter manually.
const NEARBY_STATES = {
  'Andhra Pradesh':   ['Telangana', 'Karnataka', 'Tamil Nadu', 'Odisha', 'Chhattisgarh'],
  'Arunachal Pradesh':['Assam', 'Nagaland', 'Manipur', 'Meghalaya', 'Sikkim'],
  'Assam':            ['Arunachal Pradesh', 'Nagaland', 'Manipur', 'Mizoram', 'Tripura', 'Meghalaya', 'West Bengal', 'Sikkim'],
  'Bihar':            ['Uttar Pradesh', 'Jharkhand', 'West Bengal'],
  'Chhattisgarh':     ['Madhya Pradesh', 'Maharashtra', 'Odisha', 'Jharkhand', 'Telangana', 'Andhra Pradesh'],
  'Goa':              ['Maharashtra', 'Karnataka'],
  'Gujarat':          ['Rajasthan', 'Madhya Pradesh', 'Maharashtra', 'Dadra and Nagar Haveli and Daman and Diu'],
  'Haryana':          ['Punjab', 'Himachal Pradesh', 'Uttarakhand', 'Uttar Pradesh', 'Rajasthan', 'Delhi'],
  'Himachal Pradesh': ['Punjab', 'Haryana', 'Uttarakhand', 'Jammu and Kashmir', 'Ladakh'],
  'Jharkhand':        ['Bihar', 'West Bengal', 'Odisha', 'Chhattisgarh', 'Uttar Pradesh'],
  'Karnataka':        ['Goa', 'Maharashtra', 'Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Kerala'],
  'Kerala':           ['Karnataka', 'Tamil Nadu'],
  'Madhya Pradesh':   ['Rajasthan', 'Gujarat', 'Maharashtra', 'Chhattisgarh', 'Uttar Pradesh'],
  'Maharashtra':      ['Gujarat', 'Madhya Pradesh', 'Chhattisgarh', 'Telangana', 'Andhra Pradesh', 'Karnataka', 'Goa', 'Dadra and Nagar Haveli and Daman and Diu'],
  'Manipur':          ['Nagaland', 'Assam', 'Mizoram', 'Arunachal Pradesh'],
  'Meghalaya':        ['Assam', 'Tripura'],
  'Mizoram':          ['Assam', 'Manipur', 'Tripura'],
  'Nagaland':         ['Arunachal Pradesh', 'Assam', 'Manipur'],
  'Odisha':           ['West Bengal', 'Jharkhand', 'Chhattisgarh', 'Andhra Pradesh'],
  'Punjab':           ['Haryana', 'Himachal Pradesh', 'Rajasthan', 'Jammu and Kashmir', 'Chandigarh'],
  'Rajasthan':        ['Punjab', 'Haryana', 'Delhi', 'Uttar Pradesh', 'Madhya Pradesh', 'Gujarat'],
  'Sikkim':           ['West Bengal', 'Assam', 'Arunachal Pradesh'],
  'Tamil Nadu':       ['Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Puducherry'],
  'Telangana':        ['Maharashtra', 'Chhattisgarh', 'Odisha', 'Andhra Pradesh', 'Karnataka'],
  'Tripura':          ['Assam', 'Mizoram', 'Meghalaya'],
  'Uttar Pradesh':    ['Uttarakhand', 'Himachal Pradesh', 'Haryana', 'Delhi', 'Rajasthan', 'Madhya Pradesh', 'Chhattisgarh', 'Jharkhand', 'Bihar'],
  'Uttarakhand':      ['Himachal Pradesh', 'Haryana', 'Uttar Pradesh', 'Delhi'],
  'West Bengal':      ['Sikkim', 'Assam', 'Bihar', 'Jharkhand', 'Odisha'],
  'Chandigarh':       ['Punjab', 'Haryana'],
  'Delhi':            ['Haryana', 'Uttar Pradesh', 'Rajasthan', 'Uttarakhand'],
  'Jammu and Kashmir':['Himachal Pradesh', 'Punjab', 'Ladakh'],
  'Ladakh':           ['Jammu and Kashmir', 'Himachal Pradesh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Gujarat', 'Maharashtra'],
  'Puducherry':       ['Tamil Nadu'],
};

// Compare state names ignoring case, spaces and punctuation: partners type
// their state by hand, so "Tamilnadu" and "Tamil Nadu" must count as the same.
const normState = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

// Returns the set of nearby states (normalised with normState) for a given state.
function getNearbyStates(state) {
  if (!state) return new Set();
  const key = Object.keys(NEARBY_STATES).find(k => normState(k) === normState(state));
  return new Set((NEARBY_STATES[key] || []).map(normState));
}

// Read-only "label: value" row, reused across the DSA/tenant detail panels.
function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--outline)' }}>
      <span style={{ fontSize: 12, color: 'var(--on-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  );
}

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return { isMobile };
};

const AdminMsmeCaseAllocatePage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  const [caseData, setCaseData] = useState(null);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [tenantSummary, setTenantSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [caseRes, targetsRes] = await Promise.all([
          getDirectMsmeCaseDetail(caseId),
          getAllocationTargets(),
        ]);
        setCaseData(caseRes);
        setTargets(Array.isArray(targetsRes) ? targetsRes : []);
        // The state filter deliberately starts on "All States": narrowing it to
        // the customer's state would hide the nearby-state partners, which are
        // meant to be suggested right under the exact-state ones.
      } catch (err) {
        toast.error('Failed to load case for allocation');
        navigate('/admin/msme-cases');
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId, navigate]);

  const allDsaUsers = useMemo(() => targets.flatMap(t =>
    (t.users || [])
      .filter(u => u.role?.name === 'DSA_ADMIN')
      .map(u => ({
        tenant_id: t.id,
        tenant: t,
        user_id: u.id,
        user: u,
      }))
  ), [targets]);

  // Where the customer is - worked out by the server (stage 1 pincode, else the
  // GST / synced profile state), since the customer record has no state of its
  // own. A partner serving this state, or a neighbouring one, is "Suggested":
  // that's the point of collecting operational_states at DSA registration /
  // profile (see OrganizationProfilePage.jsx).
  const caseState = caseData?.location?.state?.trim() || '';

  const query = search.trim().toLowerCase();
  const filteredUsers = useMemo(() => {
    const nearbyStates = getNearbyStates(caseState);
    return allDsaUsers
      .filter(u => !query || u.tenant.name?.toLowerCase().includes(query) || u.user.name?.toLowerCase().includes(query))
      .filter(u => !stateFilter || (u.tenant.operational_states || []).some(s => s.toLowerCase() === stateFilter.toLowerCase()))
      .map(u => {
        // A partner serves the states it lists AND the state it is based in.
        const served = [...(u.tenant.operational_states || []), u.tenant.state].filter(Boolean);
        const servesState = !!caseState && served.some(s => normState(s) === normState(caseState));
        const nearbyServed = !servesState && !!caseState ? served.find(s => nearbyStates.has(normState(s))) : null;
        return {
          ...u,
          servesState,
          isSuggested: servesState || !!nearbyServed,
          // Why it is suggested, shown under the partner name.
          suggestionReason: servesState
            ? `Serves ${caseState}`
            : nearbyServed ? `Serves nearby ${toTitleCase(nearbyServed)}` : '',  // e.g. "Serves nearby Karnataka"
        };
      })
      // Sort: serves the customer's state → serves a nearby state → rest;
      // alphabetical within each group.
      .sort((a, b) => {
        const tierA = a.servesState ? 0 : a.isSuggested ? 1 : 2;
        const tierB = b.servesState ? 0 : b.isSuggested ? 1 : 2;
        if (tierA !== tierB) return tierA - tierB;
        return (a.tenant.name || '').localeCompare(b.tenant.name || '');
      });
  }, [allDsaUsers, query, stateFilter, caseState]);

  const selectUser = async (u) => {
    setSelectedUser(u);
    setSearch('');
    setTenantSummary(null);
    setLoadingSummary(true);
    try {
      const summary = await getTenantSummary(u.tenant_id);
      setTenantSummary(summary);
    } catch (err) {
      // Non-fatal — the compliance/contact fields already came from
      // getAllocationTargets and render regardless; this only adds the
      // wallet/usage stats on top.
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleAllocate = async () => {
    if (!selectedUser) {
      toast.error('Please select a Sourcing Partner and an agent');
      return;
    }
    setAllocating(true);
    try {
      await allocateDirectMsmeCase(caseId, { dsa_tenant_id: selectedUser.tenant_id, dsa_user_id: selectedUser.user_id });
      toast.success(`Case successfully ${caseData.assigned_dsa_tenant_id ? 're-allocated' : 'allocated'} to Sourcing Partner`);
      // Tells the sidebar's "Direct MSME Leads" badge to recount right away.
      window.dispatchEvent(new Event('admin-msme-leads-changed'));
      navigate('/admin/msme-cases');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to allocate case');
    } finally {
      setAllocating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <LoadingSpinner size={40} fullPage />
      </div>
    );
  }

  if (!caseData) return null;

  const businessName = toTitleCase(resolveEntityName(caseData.customer)) || 'N/A';
  const tenant = selectedUser?.tenant;
  const agent = selectedUser?.user;
  const isReallocation = !!caseData.assigned_dsa_tenant_id;
  document.title = `Cred2Tech | ${isReallocation ? 'Reallocate' : 'Allocate'} MSME Case`;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--on-surface)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '68px 16px 0' : '24px 24px 0', background: 'var(--bg)', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/admin/msme-cases')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--on-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12, padding: 0 }}
        >
          <ArrowLeft size={14} /> Back to Direct MSME Leads
        </button>
        <PageHeader
          title={`${isReallocation ? 'Reallocate' : 'Allocate'} Case — ${businessName}`}
          subtitle={`PAN: ${maskPan(caseData.customer?.business_pan)} · ${caseData.product_type || 'Product not specified'}`}
          compact={isMobile}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px 16px 24px' : '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>Case Summary</h3>
          </div>
          <div style={{ padding: '0 20px 4px', display: 'flex', flexWrap: 'wrap' }}>
            {[
              { label: 'Requested Loan', value: (caseData.loan_amount || caseData.sanctioned_amount) ? `₹${Number(caseData.loan_amount || caseData.sanctioned_amount).toLocaleString('en-IN')}` : 'Not Specified' },
              { label: 'Stage', value: <Badge type="level" value={caseData.stage} /> },
              { label: 'Payment', value: caseData.case_payment?.status === 'PAID' ? 'Paid' : 'Pending' },
              { label: 'Location', value: [caseData.location?.state, caseData.location?.pincode].filter(Boolean).join(' – ') || '—' },
              { label: 'Registered', value: formatDate(caseData.created_at) },
            ].map((item, i) => (
              <div key={i} style={{ minWidth: 160, flex: 1, padding: '14px 20px 14px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--on-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {isReallocation && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>Current Allocation</h3>
            </div>
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle2 size={18} color="var(--success)" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{caseData.assigned_dsa_user?.tenant?.name || 'Unknown Sourcing Partner'}</div>
                <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>
                  Agent: {caseData.assigned_dsa_user?.name || 'Unknown'} · Allocated {caseData.allocated_at ? formatDate(caseData.allocated_at) : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
              {isReallocation ? 'Search & Select New Sourcing Partner' : 'Search & Select Sourcing Partner'}
            </h3>
            {caseState
              ? <p style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 4, marginBottom: 0 }}>Customer is in {caseState}. Sourcing Partners serving {caseState} or a nearby state are suggested at the top — narrow further by name or state below.</p>
              : <p style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 4, marginBottom: 0 }}>Type a Sourcing Partner company or agent name, or filter by state — narrows as you type.</p>
            }
          </div>
          <div style={{ padding: 20 }}>
            {selectedUser ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '12px 14px', border: '1px solid var(--outline)', background: 'var(--bg-elevated)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={18} color="var(--success)" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{tenant?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>Agent: {agent?.name} ({roleLabel(agent?.role?.name)})</div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedUser(null); setTenantSummary(null); }}>Change</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ position: 'relative', flex: 2, minWidth: 220 }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Sourcing Partner or Agent Name</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} color="var(--on-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        className="form-control"
                        style={{ paddingLeft: 36 }}
                        placeholder="Type Sourcing Partner or agent name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                      <MapPin size={12} /> State
                    </label>
                    <CustomSelect
                      className="form-control"
                      value={stateFilter}
                      onChange={e => setStateFilter(e.target.value)}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">All States</option>
                      {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </CustomSelect>
                  </div>
                </div>

                <div style={{
                  marginTop: 12,
                  background: 'var(--surface)', border: '1px solid var(--outline)',
                  maxHeight: 320, overflowY: 'auto',
                }}>
                  {filteredUsers.map(u => (
                    <div
                      key={`${u.tenant_id}-${u.user_id}`}
                      onClick={() => selectUser(u)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--outline)', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>{u.tenant.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--on-muted)' }}>Agent: {u.user.name} ({roleLabel(u.user.role?.name)})</div>
                        {u.suggestionReason && (
                          <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 2 }}>{u.suggestionReason}</div>
                        )}
                      </div>
                      {u.isSuggested && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                          padding: '3px 8px', fontSize: 11, fontWeight: 700,
                          color: 'var(--success)', background: 'var(--success-bg)', borderRadius: 0,
                        }}>
                          <Sparkles size={11} /> Suggested
                        </span>
                      )}
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--on-muted)' }}>No matching Sourcing Partner found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedUser && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>Sourcing Partner Agent Details</h3>
                <User size={16} color="var(--on-muted)" />
              </div>
              <div style={{ padding: 20 }}>
                <InfoRow label="Name" value={toTitleCase(agent?.name)} />
                <InfoRow label="Role" value={roleLabel(agent?.role?.name)} />
                <InfoRow label="Designation" value={agent?.designation} />
                <InfoRow label="Email" value={agent?.email} />
                <InfoRow label="Mobile" value={agent?.mobile} />
                <InfoRow label="Status" value={<Badge type="status" value={agent?.status} />} />
                <InfoRow label="Joined" value={formatDate(agent?.created_at)} />
                <InfoRow label="Last Login" value={agent?.last_login_at ? formatDate(agent.last_login_at) : 'Never'} />
              </div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--outline)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>Tenant Details</h3>
                <Building2 size={16} color="var(--on-muted)" />
              </div>
              <div style={{ padding: 20 }}>
                <InfoRow label="Company Name" value={tenant?.name} />
                <InfoRow label="Company Type" value={tenant?.company_type} />
                <InfoRow label="Status" value={<Badge type="status" value={tenant?.status} />} />
                <InfoRow label="Email" value={tenant?.email} />
                <InfoRow label="Mobile" value={tenant?.mobile} />
                <InfoRow label="PAN" value={tenant?.pan_number} />
                <InfoRow label="GST" value={tenant?.gst_number} />
                <InfoRow label="Location" value={[tenant?.city, tenant?.state, tenant?.pincode].filter(Boolean).join(', ') || '—'} />
                <InfoRow label="Onboarded" value={formatDate(tenant?.created_at)} />

                {loadingSummary ? (
                  <div style={{ padding: '16px 0 0', display: 'flex', justifyContent: 'center' }}>
                    <LoadingSpinner size={20} />
                  </div>
                ) : tenantSummary && (
                  <>
                    <InfoRow label="Wallet Balance" value={`₹${Number(tenantSummary.wallet_balance).toLocaleString('en-IN')}`} />
                    <InfoRow label="Team Size" value={tenantSummary.team_size} />
                    <InfoRow label="Total Customers" value={tenantSummary.total_customers} />
                    <InfoRow label="Total Cases" value={tenantSummary.total_cases} />
                    <InfoRow label="API Usage (all-time)" value={tenantSummary.total_api_usage} />
                    <InfoRow label="Last Activity" value={tenantSummary.last_activity ? formatDate(tenantSummary.last_activity) : 'None yet'} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/admin/msme-cases')}
            disabled={allocating}
            style={{ minWidth: 120, justifyContent: 'center', borderRadius: 0 }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAllocate}
            disabled={allocating || !selectedUser}
            style={{ minWidth: 180, justifyContent: 'center', borderRadius: 0 }}
          >
            {allocating ? <LoadingSpinner size={16} color="currentColor" /> : (isReallocation ? 'Confirm Reallocation' : 'Confirm Allocation')}
          </button>
        </div>
      </div>
    </div>
  );
};


export default AdminMsmeCaseAllocatePage;
