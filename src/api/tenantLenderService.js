// frontend/src/api/tenantLenderService.js
// API client for tenant-scoped lender contact configuration.

import api from './axiosInstance';

// ── Lenders ──────────────────────────────────────────────────────────────────
export async function getTenantLenders() {
  const { data } = await api.get('/tenant/lenders');
  return data;
}

export async function createTenantLender(payload) {
  const { data } = await api.post('/tenant/lenders', payload);
  return data;
}

export async function updateTenantLender(id, payload) {
  const { data } = await api.put(`/tenant/lenders/${id}`, payload);
  return data;
}

export async function deleteTenantLender(id) {
  const { data } = await api.delete(`/tenant/lenders/${id}`);
  return data;
}

// ── Contacts ─────────────────────────────────────────────────────────────────
export async function createTenantLenderContact(payload) {
  const { data } = await api.post('/tenant/lender-contacts', payload);
  return data;
}

export async function updateTenantLenderContact(id, payload) {
  const { data } = await api.put(`/tenant/lender-contacts/${id}`, payload);
  return data;
}

export async function deleteTenantLenderContact(id) {
  const { data } = await api.delete(`/tenant/lender-contacts/${id}`);
  return data;
}

// ── Dispatch ─────────────────────────────────────────────────────────────────
export async function sendCaseToLender(caseId, payload) {
  const { data } = await api.post(`/cases/${caseId}/send-to-lender`, payload);
  return data;
}

export async function sendCaseToOtherLender(caseId, payload) {
  const { data } = await api.post(`/cases/${caseId}/send-to-other-lender`, payload);
  return data;
}
