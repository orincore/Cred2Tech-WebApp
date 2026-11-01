import React from 'react';
import { ShieldCheck } from 'lucide-react';
import FormField from './FormField';

/**
 * "Fetched from PAN record" block shown on Stage 1 once a PAN has been verified.
 *
 * Name, date of birth (and entity type for the main applicant) arrive from the PAN record itself, so none
 * of them is typed in. They are shown here, read-only and together, instead of as scattered disabled
 * inputs. Gender and pincode also come from the PAN record but are deliberately NOT shown anywhere on the
 * frontend; they are saved on the applicant and used server-side (e.g. for the bureau pull). A field with
 * no value is left out rather than shown as an empty box, and the grid reflows to however many are present.
 *
 * fields: [{ key, label, value, placeholder?, show? }]
 *   show === false hides a field; an empty value is hidden unless `alwaysShow` is set.
 */
const PanRecordPanel = ({ title = 'Fetched from PAN record', fields }) => {
  const visible = fields.filter((f) => f.show !== false && (f.alwaysShow || (f.value !== undefined && f.value !== null && String(f.value).trim() !== '')));
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--success)',
        padding: '16px 20px 20px',
        animation: 'slideUp 0.35s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <ShieldCheck size={15} color="var(--success)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          {title}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Read-only</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px 24px' }}>
        {visible.map((f) => (
          <FormField key={f.key} label={f.label} name={f.key} disabled>
            <input
              type="text"
              value={f.value ?? ''}
              className="form-control"
              placeholder={f.placeholder || 'Autofetched via PAN'}
              disabled
              readOnly
            />
          </FormField>
        ))}
      </div>
    </div>
  );
};

export default PanRecordPanel;
