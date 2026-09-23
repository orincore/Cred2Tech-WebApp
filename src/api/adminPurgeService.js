import axiosInstance from './axiosInstance';

// SUPER_ADMIN-only manual data-purge tool. Server-side gated by
// requireRole('SUPER_ADMIN') on /api/admin/purge/* — never DSA_ADMIN.
export const adminPurgeService = {
  getCaseStatus: async (caseId) => {
    const response = await axiosInstance.get(`/admin/purge/case/${caseId}`);
    return response.data; // { caseId, schedules, auditLogs }
  },
  manualPurge: async (caseId, reason) => {
    const response = await axiosInstance.post(`/admin/purge/case/${caseId}`, { reason });
    return response.data; // { caseId, purgedCount, alreadyPurgedCount, results }
  },
  // Permanent, irreversible full-case deletion — every related row across
  // every table, plus storage files. confirmCaseId is re-checked server-side
  // too; this isn't just a client-side nicety.
  hardDeleteCase: async (caseId, reason) => {
    const response = await axiosInstance.delete(`/admin/purge/case/${caseId}/hard-delete`, {
      data: { reason, confirmCaseId: caseId },
    });
    return response.data; // { deletedCaseId, childCaseIds, totalCasesDeleted, rowCounts, documentsDeleted, filesDeleted, filesFailed }
  },

  // Cross-tenant — the same PAN can exist as separate Customer rows in
  // different tenants, so this surfaces every one of them and every case
  // under each.
  getCasesByPan: async (pan) => {
    const response = await axiosInstance.get(`/admin/purge/pan/${encodeURIComponent(pan)}`);
    return response.data; // { pan, customers: [{ ...customer, display_name, cases: [...] }] }
  },
  // Best-effort per case — one case failing doesn't stop the rest. Response
  // always carries a full per-case breakdown, never just a single pass/fail.
  purgeAllForPan: async (pan, reason) => {
    const response = await axiosInstance.post(`/admin/purge/pan/${encodeURIComponent(pan)}/purge-all`, { reason });
    return response.data; // { pan, totalCases, purgedCount, alreadyPurgedCount, failedCount, results }
  },
  // Permanent, irreversible deletion of every case for this PAN across every
  // tenant. confirmPan is re-checked server-side too.
  hardDeleteAllForPan: async (pan, reason) => {
    const response = await axiosInstance.delete(`/admin/purge/pan/${encodeURIComponent(pan)}/hard-delete-all`, {
      data: { reason, confirmPan: pan },
    });
    return response.data; // { pan, totalRootCases, deletedCount, alreadyDeletedCount, failedCount, results }
  },
};

export default adminPurgeService;
