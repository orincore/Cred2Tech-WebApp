import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Search, Trash2, FileText, Link2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown,
  RefreshCw, X, Files, FolderOpen, HardDrive, Layers, Zap, ArrowUpCircle, LayoutList, Rows3, Clock, Download,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmModal from '../components/ui/ConfirmModal';
import CustomSelect from '../components/CustomSelect';
import StorageMeter, { formatBytes } from '../components/storage/StorageMeter';
import { storageService } from '../api/storageService';
import { notifyStorageChanged } from '../hooks/useStorageGate';
import { downloadDocument } from '../api/documentHelper';
import { getErrorMessage, formatDate, resolveEntityName, toTitleCase } from '../utils/helpers';

const MB = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
const PAGE_SIZES = [25, 50, 100];
const BULK_DELETE_FILES = 5; // this many files or more need the typed confirmation
// Same limits the server enforces on one zip download.
const ZIP_MAX_FILES = 100;
const ZIP_MAX_BYTES = 250 * MB;

const SOURCE_LABEL = { DIRECT_UPLOAD: 'Uploaded', VENDOR_DOWNLOAD: 'Pulled via Cred2Tech', SYSTEM_GENERATED: 'System' };
const SOURCE_SHORT = { DIRECT_UPLOAD: 'Uploaded', VENDOR_DOWNLOAD: 'Cred2Tech pull', SYSTEM_GENERATED: 'System' };
const SOURCE_COLOR = { DIRECT_UPLOAD: '#6366f1', VENDOR_DOWNLOAD: '#14b8a6', SYSTEM_GENERATED: '#a78bfa' };
const SOURCE_HINT = { DIRECT_UPLOAD: 'Files you or your team uploaded', VENDOR_DOWNLOAD: 'GST, ITR, bank and bureau reports', SYSTEM_GENERATED: 'Reports built from pulled data' };
const SIZE_OPTIONS = [
  { value: 0, label: 'Any size' },
  { value: 0.1 * MB, label: 'Over 100 KB' },
  { value: MB, label: 'Over 1 MB' },
  { value: 5 * MB, label: 'Over 5 MB' },
  { value: 10 * MB, label: 'Over 10 MB' },
  { value: 25 * MB, label: 'Over 25 MB' },
];
const SORT_OPTIONS = [
  { value: 'size:desc', label: 'Largest first' },
  { value: 'size:asc', label: 'Smallest first' },
  { value: 'date:desc', label: 'Newest first' },
  { value: 'date:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A to Z' },
  { value: 'name:desc', label: 'Name Z to A' },
  { value: 'type:asc', label: 'Document type' },
];

const label = (t) => String(t || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()).replace(/\b(esr|gst|itr|pan|kyc)\b/gi, (m) => m.toUpperCase());
const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);

// Spacing scale used everywhere on this page: 8 / 12 / 16 / 24.
const SECTION_GAP = 24;
const card = { background: 'var(--surface)', border: '1px solid var(--outline)' };
const muted = { color: 'var(--on-muted)', opacity: 0.7 };
const caps = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--on-muted)', opacity: 0.7 };
const inputStyle = {
  width: '100%', boxSizing: 'border-box', height: 36, padding: '0 10px', fontSize: 13,
  border: '1px solid var(--outline)', background: 'var(--surface)', color: 'var(--on-surface)', outline: 'none', borderRadius: 0,
};

const DEFAULTS = {
  search: '', source: 'ALL', type: 'ALL', stage: 'ALL', minSize: 0,
  from: '', to: '', shared: 'ALL', linked: 'ALL',
};

const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const on = () => setM(window.innerWidth <= 768);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
};

// A labelled form control, so every filter is clear without guessing.
const Field = ({ title, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
    <span style={caps}>{title}</span>
    {children}
  </label>
);

const Card = ({ title, action, children, pad = 20, style }) => (
  <section style={{ ...card, padding: pad, ...style }}>
    {(title || action) && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        {title && <h3 style={{ ...caps, margin: 0 }}>{title}</h3>}
        {action}
      </div>
    )}
    {children}
  </section>
);

const SourceTag = ({ source }) => (
  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: `color-mix(in srgb, ${SOURCE_COLOR[source]} 65%, var(--on-surface))`, background: `${SOURCE_COLOR[source]}26`, padding: '3px 8px' }}>
    {SOURCE_SHORT[source] || source}
  </span>
);

const SortHead = ({ k, sortKey, sortDir, onSort, children, align = 'left' }) => {
  const on = sortKey === k;
  const Icon = !on ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={() => onSort(k)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, cursor: 'pointer', padding: 0, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', fontWeight: 700, color: on ? 'var(--primary)' : 'inherit', opacity: on ? 1 : 0.7, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {children}<Icon size={11} />
    </button>
  );
};

// Column layout shared by the header and every row so they always line up.
const colsFor = (showCase) => (showCase
  ? '24px minmax(220px, 2.6fr) minmax(110px, 1.2fr) minmax(120px, 1.1fr) minmax(130px, 1.4fr) minmax(150px, 1.4fr) 100px 36px'
  : '24px minmax(220px, 2.8fr) minmax(110px, 1.2fr) minmax(120px, 1.1fr) minmax(150px, 1.4fr) 100px 36px');

const DownloadBtn = ({ r, onDownload, busy }) => (
  <button type="button" title="Download this file" aria-label={`Download ${r.name}`} disabled={busy}
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDownload(r); }}
    style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid transparent', color: 'var(--primary)', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1 }}>
    {busy ? <RefreshCw size={15} className="icon-loading" /> : <Download size={16} />}
  </button>
);

const FileRow = ({ r, selected, onToggle, maxBytes, showCase, isMobile, indent, onDownload, busy }) => {
  const sel = selected;
  const bg = sel ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent';
  const shared = r.shared_with > 0 && (
    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)' }} title="Another case uses this same file. Space is freed once every copy is deleted.">
      <Link2 size={11} style={{ verticalAlign: -1 }} /> Shared with {r.shared_with} other{r.shared_with > 1 ? 's' : ''}
    </span>
  );

  if (isMobile) {
    return (
      <label style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--outline)', cursor: 'pointer', background: bg }}>
        <input type="checkbox" checked={sel} onChange={() => onToggle(r.id)} style={{ marginTop: 3 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{r.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <SourceTag source={r.source_type} />
            <span style={{ fontSize: 12, ...muted }}>{label(r.document_type)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, fontSize: 12 }}>
            <span style={muted}>{formatDate(r.created_at)}{showCase && r.case_id != null ? ` · Case #${r.case_id}` : ''}</span>
            <b>{formatBytes(r.size_bytes)}</b>
          </div>
          {shared && <div style={{ marginTop: 6 }}>{shared}</div>}
        </div>
        <DownloadBtn r={r} onDownload={onDownload} busy={busy} />
      </label>
    );
  }

  return (
    <label style={{ display: 'grid', gridTemplateColumns: colsFor(showCase), alignItems: 'center', columnGap: 16, padding: `12px 20px 12px ${indent ? 44 : 20}px`, borderBottom: '1px solid var(--outline)', cursor: 'pointer', background: bg }}>
      <input type="checkbox" checked={sel} onChange={() => onToggle(r.id)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <FileText size={16} style={{ flexShrink: 0, opacity: 0.55 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
          {shared && <div style={{ marginTop: 3 }}>{shared}</div>}
        </div>
      </div>
      <div style={{ fontSize: 13 }}>{label(r.document_type)}</div>
      <div><SourceTag source={r.source_type} /></div>
      {showCase && (
        <div style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.customer}>
          {r.case_id != null ? <><b>#{r.case_id}</b>{r.customer ? <span style={muted}> {r.customer}</span> : null}</> : <span style={muted}>No case</span>}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--surface-low)' }}>
          <div style={{ width: `${Math.max(2, (r.size_bytes / maxBytes) * 100)}%`, height: '100%', background: SOURCE_COLOR[r.source_type] }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 62, textAlign: 'right' }}>{formatBytes(r.size_bytes)}</span>
      </div>
      <div style={{ fontSize: 13, ...muted }}>{formatDate(r.created_at)}</div>
      <DownloadBtn r={r} onDownload={onDownload} busy={busy} />
    </label>
  );
};

const pageNumbers = (cur, pages) => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, cur - 1, cur, cur + 1]);
  if (cur <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (cur >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => set.add(n));
  const list = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return list.flatMap((n, i) => (i && n - list[i - 1] > 1 ? ['gap', n] : [n]));
};

const Pager = ({ page, pages, total, pageSize, noun, onPage }) => {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = (on, disabled) => ({
    minWidth: 34, height: 34, padding: '0 8px', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid', borderColor: on ? 'var(--primary)' : 'var(--outline)', background: on ? 'var(--primary)' : 'var(--surface)',
    color: on ? '#fff' : 'var(--on-surface)', opacity: disabled ? 0.4 : 1,
  });
  return (
    <nav aria-label="Pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 20px', borderTop: '1px solid var(--outline)' }}>
      <span style={{ fontSize: 13, ...muted }}>
        Showing {from.toLocaleString('en-IN')} to {to.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')} {noun}
      </span>
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={btn(false, page === 1)} disabled={page === 1} onClick={() => onPage(1)} aria-label="First page">«</button>
          <button type="button" style={btn(false, page === 1)} disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</button>
          {pageNumbers(page, pages).map((n, i) => (n === 'gap'
            ? <span key={`g${i}`} style={{ padding: '0 4px', ...muted }}>…</span>
            : <button key={n} type="button" style={btn(n === page, false)} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined}>{n}</button>))}
          <button type="button" style={btn(false, page === pages)} disabled={page === pages} onClick={() => onPage(page + 1)}>Next</button>
          <button type="button" style={btn(false, page === pages)} disabled={page === pages} onClick={() => onPage(pages)} aria-label="Last page">»</button>
        </div>
      )}
    </nav>
  );
};

/**
 * Full-screen file manager for an account's storage. Everything the account holds,
 * by case or as one flat list, with filters, sorting and bulk delete. A delete removes
 * the file from S3 and frees the quota right away. Partner admins only (the server
 * enforces it too).
 */
const ManageStoragePage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [f, setF] = useState(DEFAULTS);
  const [view, setView] = useState('cases');
  const [sort, setSort] = useState('size:desc');
  const [open, setOpen] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dlBusy, setDlBusy] = useState(null); // 'one:<id>' while one file downloads, 'zip' for a bundle

  const resultsRef = React.useRef(null);
  const jumpToResults = () => setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  const set = (patch) => { setF((p) => ({ ...p, ...patch })); setPage(1); };
  // A new sort, view or page size starts again from page 1.
  useEffect(() => { setPage(1); }, [sort, view, pageSize]);
  const goToPage = (n) => { setPage(n); jumpToResults(); };

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    try {
      setData(await storageService.files());
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not load your files');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = 'Cred2Tech | Manage Storage'; }, []);

  // One flat row per file, carrying its case details so every filter and sort works on one list.
  const rows = useMemo(() => {
    if (!data) return [];
    return data.cases.flatMap((g) => {
      const customer = toTitleCase(resolveEntityName(g.customer));
      return g.files.map((file) => ({
        ...file,
        case_id: g.case_id,
        customer,
        stage: g.stage,
        product_type: g.product_type,
        case_created_at: g.case_created_at,
        ts: new Date(file.created_at).getTime(),
      }));
    });
  }, [data]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const typeOptions = useMemo(() => [...new Set(rows.map((r) => r.document_type))].sort(), [rows]);
  const stageOptions = useMemo(() => [...new Set(rows.map((r) => r.stage).filter(Boolean))].sort(), [rows]);

  const [sortKey, sortDir] = sort.split(':');
  const onSort = (k) => setSort(sortKey === k ? `${k}:${sortDir === 'asc' ? 'desc' : 'asc'}` : `${k}:${['name', 'type', 'source', 'case'].includes(k) ? 'asc' : 'desc'}`);
  const cmp = useCallback((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'size': return (a.size_bytes - b.size_bytes) * dir;
      case 'date': return (a.ts - b.ts) * dir;
      case 'type': return String(a.document_type).localeCompare(String(b.document_type)) * dir;
      case 'source': return String(a.source_type).localeCompare(String(b.source_type)) * dir;
      case 'case': return ((a.case_id ?? -1) - (b.case_id ?? -1)) * dir;
      default: return String(a.name || '').localeCompare(String(b.name || '')) * dir;
    }
  }, [sortKey, sortDir]);

  const q = f.search.trim().toLowerCase();
  const fromMs = f.from ? new Date(`${f.from}T00:00:00`).getTime() : null;
  const toMs = f.to ? new Date(`${f.to}T23:59:59`).getTime() : null;

  const filtered = useMemo(() => rows.filter((r) => {
    if (q && !(String(r.name || '').toLowerCase().includes(q) || String(r.case_id ?? '').includes(q)
      || r.customer.toLowerCase().includes(q) || label(r.document_type).toLowerCase().includes(q))) return false;
    if (f.source !== 'ALL' && r.source_type !== f.source) return false;
    if (f.type !== 'ALL' && r.document_type !== f.type) return false;
    if (f.stage !== 'ALL' && r.stage !== f.stage) return false;
    if (f.minSize && r.size_bytes < f.minSize) return false;
    if (fromMs && r.ts < fromMs) return false;
    if (toMs && r.ts > toMs) return false;
    if (f.shared === 'SHARED' && r.shared_with === 0) return false;
    if (f.shared === 'UNSHARED' && r.shared_with > 0) return false;
    if (f.linked === 'CASE' && r.case_id == null) return false;
    if (f.linked === 'NOCASE' && r.case_id != null) return false;
    return true;
  }).sort(cmp), [rows, q, f, fromMs, toMs, cmp]);

  const activeFilters = useMemo(() => {
    const out = [];
    if (f.search) out.push({ k: 'search', text: `"${f.search}"` });
    if (f.source !== 'ALL') out.push({ k: 'source', text: SOURCE_LABEL[f.source] });
    if (f.type !== 'ALL') out.push({ k: 'type', text: label(f.type) });
    if (f.stage !== 'ALL') out.push({ k: 'stage', text: `Stage: ${label(f.stage)}` });
    if (f.minSize) out.push({ k: 'minSize', text: SIZE_OPTIONS.find((s) => s.value === f.minSize)?.label || 'Size' });
    if (f.from || f.to) out.push({ k: 'dates', text: `${f.from || 'Start'} to ${f.to || 'today'}` });
    if (f.shared !== 'ALL') out.push({ k: 'shared', text: f.shared === 'SHARED' ? 'Shared files' : 'Not shared' });
    if (f.linked !== 'ALL') out.push({ k: 'linked', text: f.linked === 'CASE' ? 'In a case' : 'No case' });
    return out;
  }, [f]);
  const clearOne = (k) => set(k === 'dates' ? { from: '', to: '' } : { [k]: DEFAULTS[k] });
  const clearAll = () => set(DEFAULTS);

  // Case view: the filtered files, regrouped by case. Groups follow the same sort.
  const groups = useMemo(() => {
    const m = new Map();
    filtered.forEach((r) => {
      const key = r.case_id ?? 'none';
      if (!m.has(key)) m.set(key, { key, case_id: r.case_id, customer: r.customer, stage: r.stage, product_type: r.product_type, case_created_at: r.case_created_at, files: [], bytes: 0 });
      const g = m.get(key);
      g.files.push(r);
      g.bytes += r.size_bytes;
    });
    const list = [...m.values()];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === 'size') return (a.bytes - b.bytes) * dir;
      if (sortKey === 'date') return ((new Date(a.case_created_at || 0)) - (new Date(b.case_created_at || 0))) * dir;
      return ((a.case_id ?? 1e12) - (b.case_id ?? 1e12)) * (sortKey === 'name' ? dir : 1);
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  // Selection.
  const toggle = useCallback((id) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const toggleMany = (list) => setSelected((p) => {
    const n = new Set(p);
    const all = list.every((r) => n.has(r.id));
    list.forEach((r) => (all ? n.delete(r.id) : n.add(r.id)));
    return n;
  });
  const selectedRows = [...selected].map((id) => byId.get(id)).filter(Boolean);
  const selBytes = selectedRows.reduce((a, r) => a + r.size_bytes, 0);
  // Only files nobody else shares are certain to free space; a shared file frees its space once every copy is gone.
  const sureBytes = selectedRows.filter((r) => r.shared_with === 0).reduce((a, r) => a + r.size_bytes, 0);
  const sharedSel = selectedRows.filter((r) => r.shared_with > 0).length;
  const filteredIds = new Set(filtered.map((r) => r.id));
  const hiddenSel = selectedRows.filter((r) => !filteredIds.has(r.id)).length;
  const allFilteredOn = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  // One-click clean-up shortcuts: apply the filter and select everything it finds.
  const presets = useMemo(() => {
    const big = [...rows].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 10);
    const old = rows.filter((r) => r.source_type === 'VENDOR_DOWNLOAD' && r.ts < Date.now() - 90 * DAY);
    const loose = rows.filter((r) => r.case_id == null);
    return [
      { id: 'big', icon: Zap, title: 'Ten largest files', hint: 'The quickest way to free space.', rows: big, apply: () => { setF(DEFAULTS); setSort('size:desc'); setView('files'); setSelected(new Set(big.map((r) => r.id))); } },
      { id: 'old', icon: Clock, title: 'Pulled reports older than 90 days', hint: 'Old GST, ITR, bank and bureau reports.', rows: old, apply: () => { setF({ ...DEFAULTS, source: 'VENDOR_DOWNLOAD', to: dayStr(Date.now() - 90 * DAY) }); setSort('date:asc'); setView('files'); setSelected(new Set(old.map((r) => r.id))); } },
      { id: 'loose', icon: Files, title: 'Files not linked to a case', hint: 'Files that belong to no case.', rows: loose, apply: () => { setF({ ...DEFAULTS, linked: 'NOCASE' }); setSort('size:desc'); setView('files'); setSelected(new Set(loose.map((r) => r.id))); } },
    ];
  }, [rows]);

  const saveBlob = (blob, name) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadOne = async (r) => {
    setDlBusy(`one:${r.id}`);
    try {
      await downloadDocument(r.id, r.name);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not download this file');
    } finally {
      setDlBusy(null);
    }
  };

  const downloadSelected = async () => {
    if (selectedRows.length === 1) return downloadOne(selectedRows[0]);
    if (selectedRows.length > ZIP_MAX_FILES) return toast.error(`Select at most ${ZIP_MAX_FILES} files per download, or download in batches.`);
    if (selBytes > ZIP_MAX_BYTES) return toast.error(`These files are ${formatBytes(selBytes)}. Download up to ${formatBytes(ZIP_MAX_BYTES)} at a time, in batches.`);
    setDlBusy('zip');
    try {
      const { blob, fileName, count } = await storageService.downloadFiles(selectedRows.map((r) => r.id));
      saveBlob(blob, fileName);
      toast.success(`Downloaded ${count} file${count > 1 ? 's' : ''} as one zip.`);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not prepare the download');
    } finally {
      setDlBusy(null);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await storageService.deleteFiles([...selected]);
      if (res.deleted_count) toast.success(`Deleted ${res.deleted_count} file${res.deleted_count > 1 ? 's' : ''}. ${formatBytes(res.freed_bytes)} freed.`);
      if (res.failed?.length) toast.error(`${res.failed.length} file${res.failed.length > 1 ? 's' : ''} could not be removed. Try again.`);
      setSelected(new Set((res.failed || []).map((x) => x.id)));
      setConfirm(false);
      notifyStorageChanged();
      await load(true);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const pagePad = isMobile ? '72px 16px 24px' : '24px 32px 24px';

  if (loading) {
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner size={40} fullPage /></div>;
  }
  if (!data) return null;
  const status = data.status;
  const totalFiles = rows.length;
  const caseCount = data.cases.filter((c) => c.case_id != null).length;
  const biggestCase = [...data.cases].sort((a, b) => b.total_bytes - a.total_bytes)[0];
  const maxBytes = Math.max(1, ...filtered.map((r) => r.size_bytes));

  // How risky is this delete? Every delete asks first. A bulk delete (a whole case, files from
  // several cases, or 5 or more files) also has to be confirmed by typing DELETE.
  const selectedCaseIds = new Set(selectedRows.map((r) => r.case_id ?? 'none'));
  const wholeCases = data.cases.filter((g) => g.files.length > 0 && g.files.every((x) => selected.has(x.id))).map((g) => g.case_id);
  const isBulkDelete = wholeCases.length > 0 || selectedCaseIds.size > 1 || selected.size >= BULK_DELETE_FILES;
  const caseLabel = (id) => (id == null ? 'the files not linked to a case' : `Case #${id}`);
  const wholeCasesText = wholeCases.length > 3
    ? `${wholeCases.slice(0, 3).map(caseLabel).join(', ')} and ${wholeCases.length - 3} more`
    : wholeCases.map(caseLabel).join(', ');
  const shownBytes = filtered.reduce((a, r) => a + r.size_bytes, 0);
  const totalItems = view === 'cases' ? groups.length : filtered.length;
  const pages = Math.max(1, Math.ceil(totalItems / pageSize));
  const curPage = Math.min(page, pages);
  const startAt = (curPage - 1) * pageSize;
  const pageGroups = groups.slice(startAt, startAt + pageSize);
  const pageRows = filtered.slice(startAt, startAt + pageSize);
  const pageFiles = view === 'cases' ? pageGroups.flatMap((g) => g.files) : pageRows;
  const allPageOn = pageFiles.length > 0 && pageFiles.every((r) => selected.has(r.id));
  const totalUsed = status.used_bytes || 0;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)', color: 'var(--on-surface)' }}>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: pagePad, display: 'flex', flexDirection: 'column', gap: SECTION_GAP }}>
        <PageHeader
          compact={isMobile}
          title="Manage Storage"
          subtitle="See what is stored in your account, find what takes the most space, and delete what you no longer need."
          breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'My Profile', path: '/profile?tab=storage' }, { label: 'Manage Storage' }]}
          actions={(
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => load(true)} disabled={refreshing} aria-label="Refresh">
                <RefreshCw size={13} className={refreshing ? 'icon-loading' : ''} /> {isMobile ? '' : 'Refresh'}
              </button>
              <button className="btn btn-primary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/profile?tab=storage#plans')}>
                <ArrowUpCircle size={14} /> Upgrade Plan
              </button>
            </div>
          )}
        />

        {/* Overview: usage and what is using it, in one card */}
        <Card title="Storage used" pad={isMobile ? 16 : 24} style={{ marginTop: -8 }}>
          <StorageMeter storage={status} compact />
          <div style={{ borderTop: '1px solid var(--outline)', margin: '24px 0 20px' }} />
          <h3 style={{ ...caps, margin: '0 0 16px' }}>What is using your storage</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: isMobile ? 20 : 32 }}>
            {Object.keys(SOURCE_COLOR).map((k) => {
              const bytes = status.breakdown?.[{ DIRECT_UPLOAD: 'uploaded', VENDOR_DOWNLOAD: 'api_pulled', SYSTEM_GENERATED: 'system_generated' }[k]] || 0;
              const share = totalUsed > 0 ? (bytes / totalUsed) * 100 : 0;
              return (
                <div key={k}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
                      <span style={{ width: 10, height: 10, background: SOURCE_COLOR[k], flexShrink: 0 }} />{SOURCE_LABEL[k]}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatBytes(bytes)} <span style={{ fontSize: 12, fontWeight: 600, ...muted }}>({Math.round(share)}%)</span></span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, ...muted }}>{SOURCE_HINT[k]}</div>
                  <div style={{ height: 6, background: 'var(--surface-low)', marginTop: 10 }}><div style={{ width: `${share}%`, height: '100%', background: SOURCE_COLOR[k] }} /></div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Key numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: isMobile ? 12 : 16 }}>
          <StatCard title="Files" value={totalFiles.toLocaleString('en-IN')} subtitle="Stored in your account" icon={Files} />
          <StatCard title="Cases" value={caseCount.toLocaleString('en-IN')} subtitle="With stored files" icon={FolderOpen} color="#6366f1" />
          <StatCard title="Largest case" value={biggestCase ? formatBytes(biggestCase.total_bytes) : '0 B'} subtitle={biggestCase?.case_id != null ? `Case #${biggestCase.case_id}` : 'Not linked to a case'} icon={HardDrive} color="#f59e0b" />
          <StatCard title="Shared files" value={rows.filter((r) => r.shared_with > 0).length.toLocaleString('en-IN')} subtitle="Used by more than one case" icon={Layers} color="#a78bfa" />
        </div>

        {/* Quick clean-up */}
        <Card title="Quick clean-up">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {presets.map((p) => {
              const bytes = p.rows.reduce((a, r) => a + r.size_bytes, 0);
              const Icon = p.icon;
              const empty = p.rows.length === 0;
              return (
                <button key={p.id} type="button" disabled={empty} onClick={() => { p.apply(); jumpToResults(); }}
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 14, padding: 16, background: 'var(--bg)', border: '1px solid var(--outline)', color: 'inherit', cursor: empty ? 'not-allowed' : 'pointer', opacity: empty ? 0.55 : 1 }}>
                  <span style={{ width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}><Icon size={18} color="var(--primary)" /></span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{p.title}</span>
                    <span style={{ display: 'block', fontSize: 12, marginTop: 3, ...muted }}>{p.hint}</span>
                    <span style={{ display: 'block', fontSize: 12.5, marginTop: 8, fontWeight: 600, color: empty ? undefined : 'var(--primary)' }}>
                      {empty ? 'Nothing to clean here' : `Select ${p.rows.length} file${p.rows.length > 1 ? 's' : ''} (${formatBytes(bytes)})`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Find and filter */}
        <Card title="Find files" action={activeFilters.length ? <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Clear all filters</button> : null}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '3 1 280px' }}>
                <Field title="Search">
                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input style={{ ...inputStyle, paddingLeft: 36 }} placeholder="File name, case number, customer or type" value={f.search} onChange={(e) => set({ search: e.target.value })} />
                  </div>
                </Field>
              </div>
              <div style={{ flex: '1 1 170px' }}>
                <Field title="Sort by">
                  <CustomSelect style={inputStyle} value={sort} onChange={(e) => setSort(e.target.value)}>
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </CustomSelect>
                </Field>
              </div>
              <div style={{ display: 'flex', border: '1px solid var(--outline)', height: 36, flexShrink: 0 }}>
                {[{ id: 'cases', label: 'By case', icon: Rows3 }, { id: 'files', label: 'All files', icon: LayoutList }].map((v) => (
                  <button key={v.id} type="button" onClick={() => setView(v.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 0, cursor: 'pointer', background: view === v.id ? 'var(--primary)' : 'var(--surface)', color: view === v.id ? '#fff' : 'var(--on-surface)' }}>
                    <v.icon size={15} /> {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ ...caps, marginRight: 4 }}>Source</span>
              {[{ id: 'ALL', label: 'All sources' }, { id: 'DIRECT_UPLOAD', label: 'Uploaded' }, { id: 'VENDOR_DOWNLOAD', label: 'Pulled via Cred2Tech' }, { id: 'SYSTEM_GENERATED', label: 'System' }].map((s) => {
                const on = f.source === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => set({ source: s.id })}
                    style={{ height: 32, padding: '0 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: on ? 'var(--primary)' : 'var(--outline)', background: on ? 'var(--primary)' : 'var(--surface)', color: on ? '#fff' : 'var(--on-surface)' }}>
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
              <Field title="Document type">
                <CustomSelect style={inputStyle} value={f.type} onChange={(e) => set({ type: e.target.value })}>
                  <option value="ALL">All types</option>
                  {typeOptions.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                </CustomSelect>
              </Field>
              <Field title="Case stage">
                <CustomSelect style={inputStyle} value={f.stage} onChange={(e) => set({ stage: e.target.value })}>
                  <option value="ALL">All stages</option>
                  {stageOptions.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                </CustomSelect>
              </Field>
              <Field title="File size">
                <CustomSelect style={inputStyle} value={f.minSize} onChange={(e) => set({ minSize: Number(e.target.value) })}>
                  {SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </CustomSelect>
              </Field>
              <Field title="Sharing">
                <CustomSelect style={inputStyle} value={f.shared} onChange={(e) => set({ shared: e.target.value })}>
                  <option value="ALL">Any</option>
                  <option value="UNSHARED">Not shared</option>
                  <option value="SHARED">Shared</option>
                </CustomSelect>
              </Field>
              <Field title="Case link">
                <CustomSelect style={inputStyle} value={f.linked} onChange={(e) => set({ linked: e.target.value })}>
                  <option value="ALL">Any</option>
                  <option value="CASE">In a case</option>
                  <option value="NOCASE">Not in a case</option>
                </CustomSelect>
              </Field>
              <Field title="Added from">
                <input type="date" style={inputStyle} value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} />
              </Field>
              <Field title="Added until">
                <input type="date" style={inputStyle} value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} />
              </Field>
            </div>

            {activeFilters.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4 }}>
                <span style={caps}>Active</span>
                {activeFilters.map((a) => (
                  <span key={a.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', fontSize: 12, fontWeight: 600, background: 'var(--surface-low)', border: '1px solid var(--outline)' }}>
                    {a.text}
                    <button type="button" onClick={() => clearOne(a.k)} aria-label={`Remove filter ${a.text}`} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit', opacity: 0.6 }}><X size={13} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Results */}
        <div ref={resultsRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, scrollMarginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14 }}>
              <b>{filtered.length.toLocaleString('en-IN')}</b> of {totalFiles.toLocaleString('en-IN')} files <span style={muted}>({formatBytes(shownBytes)})</span>
              {' '}in <b>{groups.length.toLocaleString('en-IN')}</b> {groups.length === 1 ? 'case' : 'cases'}
            </span>
            {filtered.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input type="checkbox" checked={allPageOn} onChange={() => toggleMany(pageFiles)} />
                  Select this page
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input type="checkbox" checked={allFilteredOn} onChange={() => toggleMany(filtered)} />
                  Select all {filtered.length.toLocaleString('en-IN')}
                </label>
                <div style={{ width: 150 }}>
                  <CustomSelect style={inputStyle} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Items per page">
                    {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} {view === 'cases' ? 'cases' : 'files'} per page</option>)}
                  </CustomSelect>
                </div>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={card}>
              <EmptyState icon={FolderOpen} title={totalFiles === 0 ? 'No files stored' : 'No files match'} description={totalFiles === 0 ? 'Your account has no stored files.' : 'Try removing a filter or searching for something else.'}
                action={activeFilters.length ? <button className="btn btn-secondary btn-sm" onClick={clearAll}>Clear all filters</button> : null} />
            </div>
          ) : view === 'files' ? (
            <div style={card}>
              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: colsFor(true), columnGap: 16, alignItems: 'center', padding: '12px 20px', background: 'var(--surface-low)', borderBottom: '1px solid var(--outline)', ...caps, opacity: 1 }}>
                  <span />
                  <SortHead k="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>File</SortHead>
                  <SortHead k="type" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Type</SortHead>
                  <SortHead k="source" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Source</SortHead>
                  <SortHead k="case" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Case</SortHead>
                  <SortHead k="size" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Size</SortHead>
                  <SortHead k="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Added</SortHead>
                  <span />
                </div>
              )}
              {pageRows.map((r) => (
                <FileRow key={r.id} r={r} selected={selected.has(r.id)} onToggle={toggle} maxBytes={maxBytes} showCase isMobile={isMobile} onDownload={downloadOne} busy={dlBusy === `one:${r.id}`} />
              ))}
              <Pager page={curPage} pages={pages} total={totalItems} pageSize={pageSize} noun="files" onPage={goToPage} />
            </div>
          ) : (
            <>
              {pageGroups.map((g) => {
                const expanded = open.has(g.key) || activeFilters.length > 0;
                const allOn = g.files.every((r) => selected.has(r.id));
                const someOn = !allOn && g.files.some((r) => selected.has(r.id));
                return (
                  <div key={g.key} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', flexWrap: 'wrap' }}>
                      <input type="checkbox" checked={allOn} aria-label="Select all files in this case" ref={(el) => { if (el) el.indeterminate = someOn; }} onChange={() => toggleMany(g.files)} />
                      <button type="button" onClick={() => setOpen((p) => { const n = new Set(p); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, cursor: 'pointer', flex: 1, minWidth: 200, textAlign: 'left', padding: 0, color: 'inherit' }}>
                        {expanded ? <ChevronDown size={18} style={{ opacity: 0.6 }} /> : <ChevronRight size={18} style={{ opacity: 0.6 }} />}
                        <span>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>
                            {g.case_id != null ? `Case #${g.case_id}` : 'Files not linked to a case'}{g.customer ? ` · ${g.customer}` : ''}
                          </span>
                          <span style={{ display: 'block', fontSize: 12, marginTop: 3, ...muted }}>
                            {[g.product_type, g.stage && label(g.stage), g.case_created_at && `Created ${formatDate(g.case_created_at)}`].filter(Boolean).join(' · ') || 'No case details'}
                          </span>
                        </span>
                      </button>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{formatBytes(g.bytes)}</div>
                        <div style={{ fontSize: 12, marginTop: 3, ...muted }}>{g.files.length} file{g.files.length > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ borderTop: '1px solid var(--outline)' }}>
                        {g.files.map((r) => (
                          <FileRow key={r.id} r={r} selected={selected.has(r.id)} onToggle={toggle} maxBytes={maxBytes} isMobile={isMobile} indent onDownload={downloadOne} busy={dlBusy === `one:${r.id}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={card}><Pager page={curPage} pages={pages} total={totalItems} pageSize={pageSize} noun="cases" onPage={goToPage} /></div>
            </>
          )}
        </div>

        <p style={{ fontSize: 12, lineHeight: 1.6, margin: 0, ...muted }}>
          This page lists Excel, PDF and image files. Deleting one removes it from storage for good and frees its space right away. A file shared by several cases is counted once in your total, so case sizes can add up to more than the total.
          {data.excluded?.count > 0 && ` ${data.excluded.count} JSON data file${data.excluded.count > 1 ? 's' : ''} (${formatBytes(data.excluded.bytes)}) are kept and not listed here, but they still count toward your storage.`}
        </p>

        {/* Bulk action bar: sticks to the bottom of the scrolling page */}
        {selected.size > 0 && (
          <div style={{ position: 'sticky', bottom: 16, zIndex: 40, ...card, borderColor: 'var(--primary)', boxShadow: '0 10px 30px rgba(0,0,0,0.22)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14 }}><b>{selected.size}</b> file{selected.size > 1 ? 's' : ''} selected <span style={muted}>({formatBytes(selBytes)})</span></div>
              <div style={{ fontSize: 12, marginTop: 4, ...muted }}>
                Frees at least {formatBytes(sureBytes)}
                {sharedSel ? `. ${sharedSel} shared file${sharedSel > 1 ? 's' : ''} free space only when every copy is deleted` : ''}
                {hiddenSel ? `. ${hiddenSel} selected file${hiddenSel > 1 ? 's are' : ' is'} hidden by your filters` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
              <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }} onClick={downloadSelected} disabled={dlBusy === 'zip'} title="Keep a copy on your computer before deleting">
                {dlBusy === 'zip' ? <RefreshCw size={14} className="icon-loading" /> : <Download size={14} />}
                {dlBusy === 'zip' ? 'Preparing zip…' : selected.size > 1 ? `Download ${selected.size} as zip` : 'Download'}
              </button>
              <button className="btn btn-danger btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setConfirm(true)}>
                <Trash2 size={14} /> Delete selected
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doDelete}
        title={selected.size === 1 ? 'Delete this file?' : `Delete ${selected.size} files${isBulkDelete ? ' permanently' : ''}?`}
        message={`This permanently removes ${selected.size > 1 ? `${selected.size} files` : 'this file'} (${formatBytes(selBytes)}) from your storage and cannot be undone.`
          + (wholeCases.length ? ` This includes every file in ${wholeCasesText}.` : '')
          + (selectedCaseIds.size > 1 ? ` The files come from ${selectedCaseIds.size} different cases.` : '')
          + (sharedSel ? ` ${sharedSel} of them ${sharedSel > 1 ? 'are' : 'is'} also used by other cases, which keep their own copy, so ${sharedSel > 1 ? 'those free' : 'that one frees'} no space until every case using ${sharedSel > 1 ? 'them' : 'it'} is deleted.` : '')}
        notice="Want a copy first? Cancel, then use Download to keep a backup on your computer."
        confirmLabel="Delete permanently"
        confirmText={isBulkDelete ? 'DELETE' : undefined}
        danger
        isLoading={deleting}
      />
    </div>
  );
};

export default ManageStoragePage;
