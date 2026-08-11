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
};

export default adminPurgeService;
