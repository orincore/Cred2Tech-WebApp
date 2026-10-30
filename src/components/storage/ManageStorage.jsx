import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ArrowLeft, ChevronDown, ChevronRight, Search, Trash2, FileText, Link2 } from 'lucide-react';
import { storageService } from '../../api/storageService';
import { notifyStorageChanged } from '../../hooks/useStorageGate';
import { getErrorMessage, formatDate, resolveEntityName, toTitleCase } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import ConfirmModal from '../ui/ConfirmModal';
import StorageMeter, { formatBytes } from './StorageMeter';

const box = { background: 'var(--surface)', border: '1px solid var(--outline)', marginBottom: 12 };
const SOURCE_LABEL = { DIRECT_UPLOAD: 'Uploaded', VENDOR_DOWNLOAD: 'API pull', SYSTEM_GENERATED: 'System' };
const SOURCE_FILTERS = [
  { id: 'ALL', label: 'All files' },
  { id: 'DIRECT_UPLOAD', label: 'Uploaded' },
  { id: 'VENDOR_DOWNLOAD', label: 'API pulls' },
  { id: 'SYSTEM_GENERATED', label: 'System' },
];
const typeLabel = (t) => String(t || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const groupKey = (g) => (g.case_id ?? 'none');
const groupTitle = (g) => (g.case_id == null
  ? 'Files not linked to a case'
  : `Case #${g.case_id}`);

/**
 * Profile → Storage → Manage storage. Every file the account holds, laid out by
 * case, with delete. A delete removes the object from S3 (not just the database),
 * which is what actually frees quota — the server recounts and returns the new status.
 * DSA_ADMIN only (the server enforces it; StorageCard only offers it to admins).
 */
const ManageStorage = ({ onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('ALL');
  const [open, setOpen] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await storageService.files());
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to load your files');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  // Filtered view: keeps a case if the case itself matches the search, or any of its files do.
  const groups = useMemo(() => {
    if (!data) return [];
    return data.cases
      .map((g) => {
        const customer = toTitleCase(resolveEntityName(g.customer));
        const caseMatches = !q || String(g.case_id ?? '').includes(q) || customer.toLowerCase().includes(q);
        const files = g.files.filter((f) => (source === 'ALL' || f.source_type === source)
          && (caseMatches || (f.name || '').toLowerCase().includes(q) || typeLabel(f.document_type).toLowerCase().includes(q)));
        return { ...g, customer_name: customer, shown: files };
      })
      .filter((g) => g.shown.length > 0);
  }, [data, q, source]);

  const fileById = useMemo(() => {
    const m = new Map();
    (data?.cases || []).forEach((g) => g.files.forEach((f) => m.set(f.id, f)));
    return m;
  }, [data]);

  const toggleOpen = (key) => setSelectedSet(setOpen, key);
  const toggleFile = (id) => setSelectedSet(setSelected, id);
  const toggleGroup = (g) => setSelected((prev) => {
    const next = new Set(prev);
    const allOn = g.shown.every((f) => next.has(f.id));
    g.shown.forEach((f) => (allOn ? next.delete(f.id) : next.add(f.id)));
    return next;
  });

  const selectedFiles = [...selected].map((id) => fileById.get(id)).filter(Boolean);
  const selectedBytes = selectedFiles.reduce((a, f) => a + f.size_bytes, 0);
  const sharedSelected = selectedFiles.filter((f) => f.shared_with > 0).length;

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await storageService.deleteFiles([...selected]);
      if (res.deleted_count) {
        toast.success(`Deleted ${res.deleted_count} file${res.deleted_count > 1 ? 's' : ''} — ${formatBytes(res.freed_bytes)} freed`);
      }
      if (res.failed?.length) toast.error(`${res.failed.length} file${res.failed.length > 1 ? 's' : ''} could not be removed. Please try again.`);
      setSelected(new Set(res.failed?.map((f) => f.id) || []));
      setConfirm(false);
      notifyStorageChanged(); // banner + pull screens pick up the new usage
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div style={{ padding: 40 }}><LoadingSpinner /></div>;
  if (!data) return null;
  const status = data.status;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <ArrowLeft size={14} /> Back to storage
      </button>

      <div style={{ ...box, padding: 20 }}>
        <StorageMeter storage={status} />
        <p style={{ fontSize: 11.5, color: 'var(--on-muted)', margin: '12px 0 0', lineHeight: 1.6 }}>
          Deleting a file removes it permanently from storage and frees its space straight away. Some files are shared by several cases
          (marked <Link2 size={11} style={{ verticalAlign: -1 }} /> shared) — space is only freed once every case using that file is deleted,
          and an account&apos;s total counts such a file once, so case sizes below can add up to more than the total.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={14} color="var(--on-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="form-control" style={{ paddingLeft: 34 }} placeholder="Search case number, customer or file name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SOURCE_FILTERS.map((f) => (
            <button key={f.id} className={source === f.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} style={{ borderRadius: 0 }} onClick={() => setSource(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <div style={{ ...box, padding: 28, textAlign: 'center', color: 'var(--on-muted)', fontSize: 13 }}>
          {data.cases.length === 0 ? 'No files are stored in this account.' : 'No files match your search.'}
        </div>
      )}

      {groups.map((g) => {
        const key = groupKey(g);
        const expanded = open.has(key) || !!q;
        const allOn = g.shown.every((f) => selected.has(f.id));
        const someOn = !allOn && g.shown.some((f) => selected.has(f.id));
        return (
          <div key={key} style={box}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', flexWrap: 'wrap' }}>
              <input
                type="checkbox" checked={allOn} aria-label={`Select all files in ${groupTitle(g)}`}
                ref={(el) => { if (el) el.indeterminate = someOn; }}
                onChange={() => toggleGroup(g)}
              />
              <button type="button" onClick={() => toggleOpen(key)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, cursor: 'pointer', flex: 1, minWidth: 220, textAlign: 'left', padding: 0 }}>
                {expanded ? <ChevronDown size={16} color="var(--on-muted)" /> : <ChevronRight size={16} color="var(--on-muted)" />}
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--on-surface)' }}>
                    {groupTitle(g)}{g.customer_name ? ` · ${g.customer_name}` : ''}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--on-muted)', marginTop: 2 }}>
                    {[g.product_type, g.stage && typeLabel(g.stage), g.case_created_at && `Created ${formatDate(g.case_created_at)}`].filter(Boolean).join(' · ') || 'No case details'}
                  </div>
                </div>
              </button>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{formatBytes(g.total_bytes)}</div>
                <div style={{ fontSize: 11, color: 'var(--on-muted)' }}>{g.files.length} file{g.files.length > 1 ? 's' : ''}</div>
              </div>
            </div>

            {expanded && (
              <div style={{ borderTop: '1px solid var(--outline)' }}>
                {g.shown.map((f) => (
                  <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px 9px 40px', borderBottom: '1px solid var(--outline)', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleFile(f.id)} />
                    <FileText size={15} color="var(--on-muted)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--on-surface)', wordBreak: 'break-all' }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--on-muted)', marginTop: 1 }}>
                        {typeLabel(f.document_type)} · {SOURCE_LABEL[f.source_type] || f.source_type} · {formatDate(f.created_at)}
                        {f.shared_with > 0 && (
                          <span style={{ marginLeft: 8, color: 'var(--warning)', fontWeight: 600 }} title="This file is also used by another case. Space is freed only when all of them are deleted.">
                            <Link2 size={11} style={{ verticalAlign: -1 }} /> shared with {f.shared_with} other{f.shared_with > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{formatBytes(f.size_bytes)}</div>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {selected.size > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, background: 'var(--surface)', border: '1px solid var(--primary)', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 12,
        }}>
          <div style={{ fontSize: 13, color: 'var(--on-surface)' }}>
            <b>{selected.size}</b> file{selected.size > 1 ? 's' : ''} selected · up to <b>{formatBytes(selectedBytes)}</b> to free
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
            <button className="btn btn-danger btn-sm" style={{ borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setConfirm(true)}>
              <Trash2 size={14} /> Delete selected
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doDelete}
        title={`Delete ${selected.size} file${selected.size > 1 ? 's' : ''}?`}
        message={`This permanently removes ${selected.size > 1 ? 'these files' : 'this file'} (${formatBytes(selectedBytes)}) from your storage. It cannot be undone`
          + (sharedSelected ? `. ${sharedSelected} of them ${sharedSelected > 1 ? 'are' : 'is'} also used by other cases, which keep their own copy, so ${sharedSelected > 1 ? 'those' : 'that one'} free${sharedSelected > 1 ? '' : 's'} no space until every case using ${sharedSelected > 1 ? 'them' : 'it'} is deleted.` : '.')}
        confirmLabel="Delete permanently"
        confirmText="DELETE"
        danger
        isLoading={deleting}
      />
    </div>
  );
};

// Toggle one value in a Set held in state.
function setSelectedSet(setter, value) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  });
}

export default ManageStorage;
