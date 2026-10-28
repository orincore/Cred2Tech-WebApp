import api from './axiosInstance';

// Document storage for the signed-in account (5 GB free, paid plans above that).
// Usage is visible to everyone in the account; buying/changing/cancelling a plan
// is DSA_ADMIN-only on the server.
export const storageService = {
  status: async () => (await api.get('/storage/status')).data,
  subscribe: async (planGb) => (await api.post('/storage/subscribe', { plan_gb: planGb })).data,
  confirm: async (payload) => (await api.post('/storage/confirm', payload)).data,
  upgrade: async (planGb) => (await api.post('/storage/upgrade', { plan_gb: planGb })).data,
  confirmUpgrade: async (payload) => (await api.post('/storage/confirm-upgrade', payload)).data,
  downgrade: async (planGb) => (await api.post('/storage/downgrade', { plan_gb: planGb })).data,
  cancel: async () => (await api.post('/storage/cancel')).data,
};

export default storageService;
