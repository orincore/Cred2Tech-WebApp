import api from './axiosInstance';

// White-label organisations admin API (Super Admin only). Sensitive calls take `headers` so the step-up prompt can retry
// them with a fresh authenticator code or password (see pages/whitelabel/StepUp.jsx).
const data = (r) => r.data;

export const whitelabelService = {
  config: () => api.get('/admin/whitelabel/config').then(data),
  list: (params) => api.get('/admin/whitelabel', { params }).then(data),
  get: (id) => api.get(`/admin/whitelabel/${id}`).then((r) => r.data.organisation),
  checkSubdomain: (slug) => api.get('/admin/whitelabel/subdomain-check', { params: { slug } }).then(data),
  create: (body, headers = {}) => api.post('/admin/whitelabel', body, { headers }).then((r) => r.data.organisation),
  update: (id, body, headers = {}) => api.patch(`/admin/whitelabel/${id}`, body, { headers }).then((r) => r.data.organisation),
  updateBranding: (id, body) => api.put(`/admin/whitelabel/${id}/branding`, body).then((r) => r.data.branding),
  uploadAsset: (id, kind, file) => {
    const form = new FormData(); form.append('file', file);
    return api.put(`/admin/whitelabel/${id}/assets/${kind}`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data.asset);
  },
  deleteAsset: (id, kind) => api.delete(`/admin/whitelabel/${id}/assets/${kind}`).then(data),
  // images need the login token, which an <img src> cannot send: fetch the bytes and show them from a local URL
  assetBlobUrl: async (id, kind) => URL.createObjectURL((await api.get(`/admin/whitelabel/${id}/assets/${kind}`, { responseType: 'blob' })).data),
  audit: (id) => api.get(`/admin/whitelabel/${id}/audit`).then((r) => r.data.entries),
  provision: (id, headers = {}) => api.post(`/admin/whitelabel/${id}/provision`, {}, { headers }).then(data),
  provisioningStatus: (id) => api.get(`/admin/whitelabel/${id}/provisioning`).then((r) => r.data.provisioning),
  retry: (id, headers = {}) => api.post(`/admin/whitelabel/${id}/provisioning/retry`, {}, { headers }).then(data),
  rollback: (id, headers = {}) => api.post(`/admin/whitelabel/${id}/provisioning/rollback`, {}, { headers }).then(data),
  cancel: (id, headers = {}) => api.post(`/admin/whitelabel/${id}/provisioning/cancel`, {}, { headers }).then(data),
  health: () => api.get('/admin/whitelabel/health').then(data),
  usage: (id) => api.get(`/admin/whitelabel/${id}/usage`).then((r) => r.data.usage),
  analytics: (id) => api.get(`/admin/whitelabel/${id}/analytics`).then((r) => r.data.analytics),
  wallet: (id, tenantId, limit) => api.get(`/admin/whitelabel/${id}/wallet`, { params: { ...(tenantId ? { tenant_id: tenantId } : {}), ...(limit ? { limit } : {}) } }).then(data),
  adjustWallet: (id, body, headers = {}) => api.post(`/admin/whitelabel/${id}/wallet/adjust`, body, { headers }).then(data),
  platformFee: (id) => api.get(`/admin/whitelabel/${id}/platform-fee`).then(data),
  setPlatformFee: (id, credits, headers = {}) => api.put(`/admin/whitelabel/${id}/platform-fee`, { credits }, { headers }).then(data),
  chargePlatformFee: (id, headers = {}) => api.post(`/admin/whitelabel/${id}/platform-fee/charge`, {}, { headers }).then(data),
  setLimits: (id, body) => api.put(`/admin/whitelabel/${id}/limits`, body).then(data),
  suspend: (id, reason, headers = {}) => api.post(`/admin/whitelabel/${id}/suspend`, { reason }, { headers }).then((r) => r.data.organisation),
  resume: (id, headers = {}) => api.post(`/admin/whitelabel/${id}/resume`, {}, { headers }).then((r) => r.data.organisation),
  releaseName: (id, headers = {}) => api.post(`/admin/whitelabel/${id}/release-name`, {}, { headers }).then(data),
};

export const apiError = (err, fallback = 'Something went wrong') => err?.response?.data?.error || err?.message || fallback;
export const fieldErrors = (err) => err?.response?.data?.fields || {};
