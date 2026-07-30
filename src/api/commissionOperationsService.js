import api from './axiosInstance';

// --- LENDER COMMISSION APIs ---

export const getLenderCommissions = async (filters) => {
    const params = new URLSearchParams();

    if (filters.month) params.append('month', filters.month);
    if (filters.lenderName && filters.lenderName !== 'All Lenders') params.append('lender_name', filters.lenderName);
    if (filters.product && filters.product !== 'All Products') params.append('product_type', filters.product);
    if (filters.search) params.append('search', filters.search);

    const response = await api.get(`/commission-operations/lender-commission?${params.toString()}`);
    return response.data;
};

export const getInvoiceCandidates = async (lenderName, product, month) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (lenderName && lenderName !== 'All Lenders') params.append('lender_name', lenderName);
    if (product && product !== 'All Products') params.append('product_type', product);

    const response = await api.get(`/commission-operations/lender-commission/invoice-candidates?${params.toString()}`);
    return response.data;
};

export const previewInvoice = async (ledgerIds, lenderName, month) => {
    const response = await api.post(`/commission-operations/lender-commission/preview-invoice`, {
        ledger_ids: ledgerIds,
        lender_name: lenderName,
        month
    });
    return response.data;
};

export const updateLedgerStatus = async (ledgerId, status, remarks) => {
    const response = await api.patch(`/commission-operations/lender-commission/${ledgerId}/status`, {
        status,
        remarks
    });
    return response.data;
};

export const syncMissingLenderCommissions = async () => {
    const response = await api.post(`/commission-operations/lender-commission/sync-missing`);
    return response.data;
};
