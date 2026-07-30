import api from './axiosInstance';

export const salesIncentiveService = {
  getRules: () => api.get('/sales-incentives/config').then(res => res.data),
  createRule: (data) => api.post('/sales-incentives/config', data).then(res => res.data),
  updateRule: (id, data) => api.put(`/sales-incentives/config/${id}`, data).then(res => res.data),
  deleteRule: (id) => api.delete(`/sales-incentives/config/${id}`).then(res => res.data),

  getEmployeesConfig: () => api.get('/sales-incentives/employees').then(res => res.data),

  getPayouts: (params) => api.get('/sales-incentives/payouts', { params }).then(res => res.data),
  calculateIncentives: (data) => api.post('/sales-incentives/calculate', data).then(res => res.data),
  updatePayoutStatus: (id, payload) => api.post(`/sales-incentives/payouts/${id}/status`, payload).then(res => res.data),
  syncMissingIncentives: (hierarchyLevel) => api.post(`/sales-incentives/config/${hierarchyLevel}/sync-missing`).then(res => res.data)
};
