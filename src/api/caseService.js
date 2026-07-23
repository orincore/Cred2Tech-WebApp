import axiosInstance from './axiosInstance';

export const caseService = {
  getAllCases: async () => {
    const response = await axiosInstance.get('/cases');
    return response.data;
  },

  // Pipeline (List, Filter, Sort, Pagination)
  getPipeline: async (params) => {
    const response = await axiosInstance.get('/cases/pipeline', { params });
    return response.data;
  },

  getCaseById: async (id) => {
    const response = await axiosInstance.get(`/cases/${id}`);
    return response.data;
  },

  createCase: async (customer_id) => {
    const response = await axiosInstance.post('/cases/create', { customer_id });
    return response.data;
  },

  addApplicant: async (caseId, applicantData) => {
    const response = await axiosInstance.post(`/cases/${caseId}/add-applicant`, applicantData);
    return response.data;
  },

  removeApplicant: async (caseId, applicantId) => {
    const response = await axiosInstance.delete(`/cases/${caseId}/applicants/${applicantId}`);
    return response.data;
  },

  reuseApplicant: async (caseId, source_applicant_id) => {
    const response = await axiosInstance.post(`/cases/${caseId}/applicants/reuse`, { source_applicant_id });
    return response.data;
  },

  updateProduct: async (caseId, product_type) => {
    const response = await axiosInstance.patch(`/cases/${caseId}/product`, { product_type });
    return response.data;
  },

  getCaseSummary: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/summary`);
    return response.data;
  },

  getCoBorrowers: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/co-borrowers`);
    return response.data;
  },

  getActivityLog: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/activity-log`);
    return response.data;
  },

  // Phase 1 —— Product & Property
  updateProductProperty: async (caseId, payload) => {
    const response = await axiosInstance.put(`/cases/${caseId}/product-property`, payload);
    return response.data;
  },

  // Phase 1 —— Income Summary
  getIncomeSummary: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/income-summary`);
    return response.data;
  },
  addIncomeEntry: async (caseId, entry) => {
    const response = await axiosInstance.post(`/cases/${caseId}/income-entries`, entry);
    return response.data;
  },
  deleteIncomeEntry: async (caseId, entryId) => {
    const response = await axiosInstance.delete(`/cases/${caseId}/income-entries/${entryId}`);
    return response.data;
  },
  confirmIncomeSummary: async (caseId) => {
    const response = await axiosInstance.put(`/cases/${caseId}/income-summary/confirm`);
    return response.data;
  },

  // Phase 1 —— Bureau Obligations
  syncObligations: async (caseId) => {
    const response = await axiosInstance.post(`/cases/${caseId}/bureau-obligations/sync`);
    return response.data;
  },
  // Actually pulls the CIBIL/bureau report for an applicant — syncObligations
  // above only re-syncs obligations from a bureau pull that must already
  // exist for this case_id, it never triggers the external fetch itself.
  runBureauVerification: async (caseId, applicantId) => {
    const response = await axiosInstance.post(`/verification/bureau/run/${caseId}`, { applicantId });
    return response.data;
  },
  getObligations: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/bureau-obligations`);
    return response.data;
  },
  addObligation: async (caseId, obligation) => {
    const response = await axiosInstance.post(`/cases/${caseId}/bureau-obligations`, obligation);
    return response.data;
  },
  updateObligation: async (caseId, oblId, data) => {
    const response = await axiosInstance.put(`/cases/${caseId}/bureau-obligations/${oblId}`, data);
    return response.data;
  },

  // Phase 1 —— ESR
  generateESR: async (caseId) => {
    const response = await axiosInstance.post(`/cases/${caseId}/esr/generate`);
    return response.data;
  },
  getESR: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/esr`);
    return response.data;
  },

  // Phase 2 —— Proposals
  createProposal: async (caseId, payload) => {
    const response = await axiosInstance.post(`/cases/${caseId}/proposals/create`, payload);
    return response.data;
  },
  listProposals: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/proposals`);
    return response.data;
  },
  getProposal: async (caseId, proposalId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/proposals/${proposalId}`);
    return response.data;
  },
  updateProposal: async (caseId, proposalId, data) => {
    const response = await axiosInstance.patch(`/cases/${caseId}/proposals/${proposalId}`, data);
    return response.data;
  },
  attachProposalDocs: async (caseId, proposalId, document_ids) => {
    const response = await axiosInstance.post(`/cases/${caseId}/proposals/${proposalId}/documents`, { document_ids });
    return response.data;
  },
  detachProposalDoc: async (caseId, proposalId, docId) => {
    const response = await axiosInstance.delete(`/cases/${caseId}/proposals/${proposalId}/documents/${docId}`);
    return response.data;
  },
  submitProposal: async (caseId, proposalId) => {
    const response = await axiosInstance.post(`/cases/${caseId}/proposals/${proposalId}/submit`);
    return response.data;
  },
  cloneProposal: async (caseId, proposalId, payload) => {
    const response = await axiosInstance.post(`/cases/${caseId}/proposals/${proposalId}/clone`, payload);
    return response.data;
  },

  updateCaseStage: async (id, stage) => {
    const response = await axiosInstance.patch(`/cases/${id}/stage`, { stage });
    return response.data;
  },

  rollbackCaseStage: async (id, payload) => {
    const response = await axiosInstance.post(`/cases/${id}/stage-rollback`, payload);
    return response.data;
  },

  // ─── Sanction & Disbursement Flow ──────────────────────────────────────────
  sanctionCase: async (caseId, payload) => {
    const response = await axiosInstance.post(`/cases/${caseId}/sanction`, payload);
    return response.data;
  },
  recordDisbursement: async (caseId, payload, idempotencyKey) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    const response = await axiosInstance.post(`/cases/${caseId}/disbursements`, payload, { headers });
    return response.data;
  },
  getDisbursementSummary: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/disbursements`);
    return response.data;
  },
  getPartialDisbursements: async () => {
    const response = await axiosInstance.get('/disbursements/partial');
    return response.data;
  },

  allocateDsaUser: async (caseId, userId) => {
    const response = await axiosInstance.post(`/cases/${caseId}/allocate-dsa-user`, { assigned_dsa_user_id: userId });
    return response.data;
  },

  downloadLoanApplicationSummary: async (caseId) => {
    const response = await axiosInstance.get(`/cases/${caseId}/loan-application-summary.xlsx`, {
      responseType: 'blob'
    });

    const disposition = response.headers?.['content-disposition'] || '';
    const utf8FileName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const quotedFileName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const fileName = utf8FileName
      ? decodeURIComponent(utf8FileName)
      : (quotedFileName || 'Loan Application Summary.xlsx');

    const blob = new Blob([response.data], {
      type: response.headers?.['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
