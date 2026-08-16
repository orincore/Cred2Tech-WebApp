import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, X, Check, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { getPayoutConfig, savePayoutConfig, syncMissingPayouts, getSubDsaMtdStats } from '../../api/subDsaPayoutService';

const fieldStyle = {
  border: '1px solid var(--outline)', borderRadius: 0, background: 'var(--surface)',
  color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, padding: '6px 10px', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const labelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block' };
const sectionHeading = { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' };
const sectionHint = { fontSize: 11, color: 'var(--text-tertiary)' };

const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile };
};

// A fixed multi-column grid row (lender/products/rate/date/delete, etc.)
// packs 5 inputs onto one line — fine on desktop, but on a phone each field
// shrinks to unusable width. Stack them 1-per-row instead, with the remove
// button pinned to its own row's end rather than sharing a row with a
// half-width input.
const rowGrid = (isMobile, desktopCols) => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : desktopCols,
  gap: isMobile ? 6 : 8,
  alignItems: isMobile ? 'stretch' : 'center',
});

/**
 * Configures how much of the DSA's commission a Sub-DSA partner earns —
 * default rate, per-lender overrides, per-case slabs, and time-bound bonus
 * schemes. Ported from Cred2Tech/frontend's DsaTeamManagementPage (the
 * working reference — see subDsaPayout.service.js for the exact field
 * contract this maps to) since the production WebApp had the API client
 * (subDsaPayoutService.js) wired up but no UI ever calling it.
 */
const SubDsaPayoutSetup = ({ userId, lenders }) => {
  const { isMobile } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [defaultRate, setDefaultRate] = useState(30);
  const [calculationBase, setCalculationBase] = useState('DISBURSED_AMOUNT');
  const [payoutTrigger, setPayoutTrigger] = useState('ON_DSA_RECEIPT');
  const [tdsApplicable, setTdsApplicable] = useState(true);
  const [overrides, setOverrides] = useState([]);
  const [slabs, setSlabs] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [mtd, setMtd] = useState({ cases: 0, dsa_earned: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPayoutConfig(userId)
      .then((cfg) => {
        if (cancelled) return;
        if (cfg) {
          setDefaultRate(cfg.default_payout_rate ?? 30);
          setCalculationBase(cfg.calculation_base || 'DISBURSED_AMOUNT');
          setPayoutTrigger(cfg.payout_trigger || 'ON_DSA_RECEIPT');
          setTdsApplicable(cfg.tds_applicable !== false);
          setOverrides((cfg.overrides || []).map((o) => ({ ...o, products: o.products || '' })));
          setSlabs(cfg.case_count_slabs || []);
          setEffectiveFrom(cfg.effective_from ? cfg.effective_from.split('T')[0] : '');
          setSchemes((cfg.special_schemes || []).map((s) => ({
            ...s,
            valid_from: s.valid_from ? s.valid_from.split('T')[0] : '',
            valid_to: s.valid_to ? s.valid_to.split('T')[0] : '',
          })));
        }
        return getSubDsaMtdStats(userId);
      })
      .then((stats) => {
        if (cancelled || !stats) return;
        setMtd({ cases: stats.cases || 0, dsa_earned: stats.dsa_earned || 0 });
      })
      .catch(() => toast.error('Failed to load payout configuration'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePayoutConfig(userId, {
        default_payout_rate: defaultRate,
        calculation_base: calculationBase,
        payout_trigger: payoutTrigger,
        tds_applicable: tdsApplicable,
        effective_from: effectiveFrom,
        overrides,
        slabs,
        schemes,
      });
      toast.success('Payout configuration saved');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save payout configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncMissingPayouts(userId);
      toast.success(res.message || 'Synced successfully');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to sync missing payouts');
    } finally {
      setSyncing(false);
    }
  };

  const addOverride = () => setOverrides((prev) => [...prev, { tenant_lender_id: '', products: '', override_rate: '', effective_from: '' }]);
  const addSlab = () => setSlabs((prev) => [...prev, { from_cases: '', to_cases: '', payout_per_case: '' }]);
  const addScheme = () => setSchemes((prev) => [...prev, { scheme_name: '', basis: 'Cases', valid_from: '', valid_to: '', bonus_per_case: '', min_case_count: '', is_active: true }]);

  if (loading) {
    return <div style={{ padding: 20 }}><LoadingSpinner size={20} /></div>;
  }

  return (
    <div style={{ padding: isMobile ? 12 : 16, borderTop: '1px solid var(--outline)', background: 'var(--bg-elevated)' }}>
      <div style={{ background: 'var(--info-bg)', border: '1px solid var(--info)', padding: '8px 12px', fontSize: 11, color: 'var(--info)', marginBottom: 18 }}>
        Volume overrides and per-case slabs are calculated independently each month and the totals are added together.
      </div>

      {/* Header configs */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 22 }}>
        <div>
          <label style={labelStyle}>Default Payout Rate *</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" min={0} max={100} step={0.5} value={defaultRate} onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 0)} style={{ ...fieldStyle, width: 80 }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>%</span>
          </div>
          <select value={calculationBase} onChange={(e) => setCalculationBase(e.target.value)} style={{ ...fieldStyle, marginTop: 6 }}>
            <option value="DISBURSED_AMOUNT">Disbursed Amount</option>
            <option value="LENDER_COMMISSION">Lender Commission</option>
          </select>
          <div style={sectionHint}>Applied to all lenders unless overridden below</div>
        </div>
        <div>
          <label style={labelStyle}>Payout Trigger</label>
          <select value={payoutTrigger} onChange={(e) => setPayoutTrigger(e.target.value)} style={fieldStyle}>
            <option value="ON_DSA_RECEIPT">On DSA receipt from lender</option>
            <option value="ON_DISBURSEMENT">On disbursement</option>
            <option value="MANUAL">Manual trigger</option>
          </select>
          <div style={sectionHint}>When Sub-DSA receives their share</div>
        </div>
        <div>
          <label style={labelStyle}>TDS Applicable</label>
          <select value={tdsApplicable ? 'yes' : 'no'} onChange={(e) => setTdsApplicable(e.target.value === 'yes')} style={fieldStyle}>
            <option value="yes">Yes — deduct TDS before payout</option>
            <option value="no">No — gross payout</option>
          </select>
          <div style={sectionHint}>TDS at applicable rate (Sec 194H)</div>
        </div>
        <div>
          <label style={labelStyle}>Effective From *</label>
          <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} style={fieldStyle} />
          <div style={sectionHint}>Start date for this overall configuration</div>
        </div>
      </div>

      {/* Per-Lender Overrides */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={sectionHeading}>Per-Lender Volume Rate Overrides</div>
            <div style={sectionHint}>Optional — leave rate blank to use the default</div>
          </div>
          <button type="button" onClick={addOverride} className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> Add Lender
          </button>
        </div>
        {overrides.length === 0 ? (
          <div style={{ padding: 14, background: 'var(--surface)', border: '1px dashed var(--outline)', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            No lender overrides — default rate applies to all lenders.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overrides.map((ov, i) => (
              <div key={i} style={{ ...rowGrid(isMobile, '2fr 2fr 1fr 1fr auto'), ...(isMobile ? { border: '1px solid var(--outline)', background: 'var(--surface)', padding: 10 } : {}) }}>
                <select value={ov.tenant_lender_id} onChange={(e) => setOverrides((prev) => prev.map((o, j) => (j === i ? { ...o, tenant_lender_id: e.target.value } : o)))} style={fieldStyle}>
                  <option value="">— Select Lender —</option>
                  {lenders.map((l) => <option key={l.id} value={l.id}>{l.lender_name}</option>)}
                </select>
                <input placeholder="e.g. LAP, Business Loan" value={ov.products} onChange={(e) => setOverrides((prev) => prev.map((o, j) => (j === i ? { ...o, products: e.target.value } : o)))} style={fieldStyle} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" placeholder="40" min={0} max={100} value={ov.override_rate} onChange={(e) => setOverrides((prev) => prev.map((o, j) => (j === i ? { ...o, override_rate: e.target.value } : o)))} style={fieldStyle} />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>%</span>
                </div>
                <input type="date" value={ov.effective_from || ''} onChange={(e) => setOverrides((prev) => prev.map((o, j) => (j === i ? { ...o, effective_from: e.target.value } : o)))} style={fieldStyle} />
                <button type="button" onClick={() => setOverrides((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: isMobile ? '100%' : 'auto' }}>
                  <X size={13} color="var(--error)" />
                  {isMobile && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--error)' }}>Remove</span>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-Case Slabs */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={sectionHeading}>Per-Case Payout Slabs</div>
            <div style={sectionHint}>Monthly case count → flat ₹ per case, stacks with the rate above</div>
          </div>
          <button type="button" onClick={addSlab} className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> Add Slab
          </button>
        </div>
        {slabs.length === 0 ? (
          <div style={{ padding: 14, background: 'var(--surface)', border: '1px dashed var(--outline)', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            No slabs configured.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slabs.map((slab, i) => (
              <div key={i} style={{ ...rowGrid(isMobile, '1fr 1fr 2fr auto'), ...(isMobile ? { border: '1px solid var(--outline)', background: 'var(--surface)', padding: 10 } : {}) }}>
                <input type="number" min={1} value={slab.from_cases} placeholder="From" onChange={(e) => setSlabs((prev) => prev.map((s, j) => (j === i ? { ...s, from_cases: e.target.value } : s)))} style={fieldStyle} />
                <input type="number" min={1} value={slab.to_cases || ''} placeholder="To (∞ if blank)" onChange={(e) => setSlabs((prev) => prev.map((s, j) => (j === i ? { ...s, to_cases: e.target.value } : s)))} style={fieldStyle} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>₹</span>
                  <input type="number" min={0} value={slab.payout_per_case} placeholder="2000" onChange={(e) => setSlabs((prev) => prev.map((s, j) => (j === i ? { ...s, payout_per_case: e.target.value } : s)))} style={fieldStyle} />
                </div>
                <button type="button" onClick={() => setSlabs((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: isMobile ? '100%' : 'auto' }}>
                  <X size={13} color="var(--error)" />
                  {isMobile && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--error)' }}>Remove</span>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Special Schemes */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={sectionHeading}>Special Payout Schemes</div>
            <div style={sectionHint}>Time-bound bonuses — stack with regular slabs</div>
          </div>
          <button type="button" onClick={addScheme} className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> Add Scheme
          </button>
        </div>
        {schemes.length === 0 ? (
          <div style={{ padding: 14, background: 'var(--surface)', border: '1px dashed var(--outline)', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            No special schemes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {schemes.map((sc, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--outline)', padding: 12 }}>
                <div style={{ ...rowGrid(isMobile, '2fr 1fr 1fr 1fr 1fr auto'), marginBottom: 8 }}>
                  <input placeholder="Scheme name e.g. Q1FY26 Bonus" value={sc.scheme_name} onChange={(e) => setSchemes((prev) => prev.map((s, j) => (j === i ? { ...s, scheme_name: e.target.value } : s)))} style={fieldStyle} />
                  <select value={sc.basis} onChange={(e) => setSchemes((prev) => prev.map((s, j) => (j === i ? { ...s, basis: e.target.value } : s)))} style={fieldStyle}>
                    <option value="Cases">Cases</option>
                    <option value="Volume">Volume</option>
                  </select>
                  <input type="date" value={sc.valid_from} onChange={(e) => setSchemes((prev) => prev.map((s, j) => (j === i ? { ...s, valid_from: e.target.value } : s)))} style={fieldStyle} />
                  <input type="date" value={sc.valid_to} onChange={(e) => setSchemes((prev) => prev.map((s, j) => (j === i ? { ...s, valid_to: e.target.value } : s)))} style={fieldStyle} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>₹</span>
                    <input type="number" placeholder="Bonus/case" value={sc.bonus_per_case} onChange={(e) => setSchemes((prev) => prev.map((s, j) => (j === i ? { ...s, bonus_per_case: e.target.value } : s)))} style={fieldStyle} />
                  </div>
                  <button type="button" onClick={() => setSchemes((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: isMobile ? '100%' : 'auto' }}>
                    <X size={13} color="var(--error)" />
                    {isMobile && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--error)' }}>Remove Scheme</span>}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, alignItems: isMobile ? 'stretch' : 'end' }}>
                  <div>
                    <label style={labelStyle}>Lender (optional)</label>
                    <select value={sc.tenant_lender_id || ''} onChange={(e) => setSchemes((prev) => prev.map((s, j) => (j === i ? { ...s, tenant_lender_id: e.target.value } : s)))} style={fieldStyle}>
                      <option value="">All Lenders</option>
                      {lenders.map((l) => <option key={l.id} value={l.id}>{l.lender_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Min Cases Required</label>
                    <input type="number" min={1} placeholder="e.g. 3" value={sc.min_case_count || ''} onChange={(e) => setSchemes((prev) => prev.map((s, j) => (j === i ? { ...s, min_case_count: e.target.value } : s)))} style={fieldStyle} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={sc.is_active} onChange={(e) => setSchemes((prev) => prev.map((s, j) => (j === i ? { ...s, is_active: e.target.checked } : s)))} />
                    Active
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MTD summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, padding: '14px 16px', background: 'var(--success-bg)', border: '1px solid var(--success)', marginBottom: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>Cases (MTD)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{mtd.cases}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>DSA Earned (MTD)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>₹{mtd.dsa_earned.toLocaleString('en-IN')}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>Sub-DSA Share ({defaultRate}%)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--info)' }}>₹{Math.round(mtd.dsa_earned * defaultRate / 100).toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
        <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: isMobile ? '100%' : 'auto' }}>
          {saving ? <LoadingSpinner size={13} color="currentColor" /> : <Check size={13} />}
          {saving ? 'Saving…' : 'Save Payout Config'}
        </button>
        <button type="button" onClick={handleSync} disabled={syncing} className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: isMobile ? '100%' : 'auto' }}>
          {syncing ? <LoadingSpinner size={13} color="currentColor" /> : <RefreshCw size={13} />}
          {syncing ? 'Syncing…' : 'Sync Past Payouts'}
        </button>
      </div>
    </div>
  );
};

export default SubDsaPayoutSetup;
