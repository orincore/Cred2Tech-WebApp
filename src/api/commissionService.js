// frontend/src/api/commissionService.js
import api from './axiosInstance';

export async function getCommissionRules() {
  const { data } = await api.get('/lender-commission');
  return data;
}

export async function getCommissionRule(id) {
  const { data } = await api.get(`/lender-commission/${id}`);
  return data;
}

export async function createCommissionRule(payload) {
  const { data } = await api.post('/lender-commission', payload);
  return data;
}

export async function updateCommissionRule(id, payload) {
  const { data } = await api.put(`/lender-commission/${id}`, payload);
  return data;
}

export async function deleteCommissionRule(id) {
  const { data } = await api.delete(`/lender-commission/${id}`);
  return data;
}



