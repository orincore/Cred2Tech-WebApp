import api from './axiosInstance';

// Document storage for the signed-in account (2 GB free, paid plans above that).
// Usage is visible to everyone in the account; buying/changing/cancelling a plan
// is DSA_ADMIN-only on the server.
export const storageService = {
  status: async () => (await api.get('/storage/status')).data,
  // Manage storage (DSA_ADMIN): every stored file grouped by case, and a delete that
  // also removes the file from S3 so the space is freed.
  files: async () => (await api.get('/storage/files')).data,
  deleteFiles: async (documentIds) => (await api.post('/storage/files/delete', { document_ids: documentIds })).data,
  subscribe: async (planGb) => (await api.post('/storage/subscribe', { plan_gb: planGb })).data,
  confirm: async (payload) => (await api.post('/storage/confirm', payload)).data,
  upgrade: async (planGb) => (await api.post('/storage/upgrade', { plan_gb: planGb })).data,
  confirmUpgrade: async (payload) => (await api.post('/storage/confirm-upgrade', payload)).data,
  downgrade: async (planGb) => (await api.post('/storage/downgrade', { plan_gb: planGb })).data,
  cancel: async () => (await api.post('/storage/cancel')).data,
};

export default storageService;
