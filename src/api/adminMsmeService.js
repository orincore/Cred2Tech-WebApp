// frontend/src/api/adminMsmeService.js
// API client for the Cred2Tech admin's Direct MSME lead allocation queue.

import api from './axiosInstance';

export async function getDirectMsmeCases() {
  const { data } = await api.get('/admin/msme-cases');
  return data;
}

export async function getDirectMsmeCaseDetail(caseId) {
  const { data } = await api.get(`/admin/msme-cases/${caseId}`);
  return data;
}

export async function getAllocationTargets() {
  const { data } = await api.get('/admin/msme-cases/allocation-targets');
  return data;
}

export async function allocateDirectMsmeCase(caseId, { dsa_tenant_id, dsa_user_id }) {
  const { data } = await api.post(`/admin/msme-cases/${caseId}/allocate`, { dsa_tenant_id, dsa_user_id });
  return data;
}
