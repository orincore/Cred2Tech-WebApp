const unwrap = value => value && typeof value === 'object' ? value.raw ?? value.value ?? (value.type === 'percent' ? Number(value.normalized) * 100 : value.normalized) : value;
const percent = value => {
  const raw = unwrap(value);
  if (raw == null || raw === '') return null;
  const match = String(raw).trim().match(/^(\d+(?:\.\d+)?)\s*%?$/);
  return match ? Number(match[1]) : null;
};

export function validateLenderMatrixChanges({ changes, schemes, parameters, productType, rulebook, matrixData }) {
  const prefix = productType?.toLowerCase();
  if (!['hl', 'lap'].includes(prefix)) return null;
  for (const id of new Set(changes.map(c => String(c.schemeId)))) {
    const scheme = schemes.find(s => String(s.id) === id);
    const method = rulebook?.methods?.find(m => String(m.scheme_id) === id)?.rule;
    const edited = changes.filter(c => String(c.schemeId) === id);
    for (const [field, label] of [['roi', 'ROI'], ['pf', 'processing fee']]) {
      const keys = [`${prefix}_${field}_min`, `${prefix}_${field}_max`];
      const parameter = key => parameters.find(p => p.parameter_key === key);
      const change = key => edited.find(c => String(c.parameterId) === String(parameter(key)?.id));
      if (!keys.some(key => change(key))) continue;
      const values = keys.map((key, i) => {
        const side = i === 0 ? 'min' : 'max';
        const c = change(key);
        if (c && unwrap(c.value) !== '') return percent(c.value);
        // A cleared override must be resolved by the server, which knows the
        // underlying baseline. Never substitute an unrelated seeded value.
        if (c) return null;
        if (method || rulebook?.product) {
          return field === 'roi' ? (method?.roi || rulebook.product?.roi)?.[side] ?? null
            : method?.[`pf_${side}`] != null ? method[`pf_${side}`] * 100 : rulebook.product?.pf?.[side] ?? null;
        }
        return percent(matrixData[`${id}_${parameter(key)?.id}`]);
      });
      if (values.every(v => v != null) && values[0] > values[1]) {
        return `${scheme?.scheme_name || 'Selected method'}: ${label} minimum (${values[0]}%) exceeds maximum (${values[1]}%). Lower the minimum or increase the maximum, then save both changes together.`;
      }
    }
  }
  return null;
}

export function lenderSaveError(error) {
  const data = error?.response?.data;
  const message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : null;
  if (message) return message;
  if (!error?.response) return 'Cannot reach the API. Check that the backend is running, then retry. Your edits have been retained.';
  if (error.response.status === 404 || error.response.status === 405) return 'The configuration save endpoint is unavailable. Run the updated backend with this frontend, then retry. Your edits have been retained.';
  return `Unable to save configuration (HTTP ${error.response.status}). Your edits have been retained; check the backend response before retrying.`;
}
