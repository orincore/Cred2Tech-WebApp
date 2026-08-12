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
};

export default adminPurgeService;
