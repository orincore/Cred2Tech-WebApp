// frontend/src/api/adminMsmeService.js
// API client for the Cred2Tech admin's Direct MSME lead allocation queue.

import api from './axiosInstance';

export async function getDirectMsmeCases() {
  const { data } = await api.get('/admin/msme-cases');
  return data;
}

// Leads still waiting to be allocated to a DSA (sidebar badge).
export async function getUnallocatedDirectMsmeCount() {
  const { data } = await api.get('/admin/msme-cases/unallocated-count');
  return data.count;
}

export async function getDirectMsmeCaseDetail(caseId) {
  const { data } = await api.get(`/admin/msme-cases/${caseId}`);
  return data;
}

// Sourcing partners to allocate to, white-labelled organisations' partners included (each of those carries
// `whitelabel_org: { id, slug, name }`). Returns { targets, unavailable_organisations }: an organisation that could not
// be read right now is named there instead of silently missing from the list.
export async function getAllocationTargets() {
  const { data } = await api.get('/admin/msme-cases/allocation-targets', { params: { include_organisations: 1 } });
  // an older backend answers with the plain list
  if (Array.isArray(data)) return { targets: data, unavailable_organisations: [] };
  return { targets: data.targets || [], unavailable_organisations: data.unavailable_organisations || [] };
}

// whitelabel_org_id: set when the partner belongs to a white-labelled organisation (its ids are that organisation's own).
export async function allocateDirectMsmeCase(caseId, { dsa_tenant_id, dsa_user_id, whitelabel_org_id }) {
  const { data } = await api.post(`/admin/msme-cases/${caseId}/allocate`, {
    dsa_tenant_id, dsa_user_id, ...(whitelabel_org_id ? { whitelabel_org_id } : {}),
  });
  return data;
}
