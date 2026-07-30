// subDsaPayoutService.js
// API service for the SubDSA payout management module.

import api from './axiosInstance';

// ── SubDSA User Management ───────────────────────────────────────────────────
export const getSubDsaUsers = () =>
  api.get('/sub-dsa/users').then(r => r.data);

// ── Payout Configuration ─────────────────────────────────────────────────────
export const getPayoutConfig = (userId) =>
  api.get(`/sub-dsa/${userId}/payout-config`).then(r => r.data);

export const getSubDsaMtdStats = (userId) =>
  api.get(`/sub-dsa/${userId}/mtd-stats`).then(r => r.data);

export const savePayoutConfig = (userId, data) =>
  api.put(`/sub-dsa/${userId}/payout-config`, data).then(r => r.data);

export const previewPayout = (userId, commissionLedgerId) =>
  api.post(`/sub-dsa/${userId}/calculate`, { commission_ledger_id: commissionLedgerId }).then(r => r.data);

// ── Payout Ledger ────────────────────────────────────────────────────────────
export const getPayouts = (params = {}) =>
  api.get('/sub-dsa/payouts', { params }).then(r => r.data);

export const updatePayoutStatus = (ledgerId, status, remarks) =>
  api.put(`/sub-dsa/payouts/${ledgerId}/status`, { status, remarks }).then(r => r.data);

export const getPayoutHistory = (ledgerId) =>
  api.get(`/sub-dsa/payouts/${ledgerId}/history`).then(r => r.data);

// ── Invoice ──────────────────────────────────────────────────────────────────
export const generateInvoice = (subDsaUserId, monthYear, ledgerIds) =>
  api.post('/sub-dsa/invoices', {
    sub_dsa_user_id: subDsaUserId,
    month_year: monthYear,
    ledger_ids: ledgerIds
  }).then(r => r.data);

export const syncMissingPayouts = (userId) =>
  api.post(`/sub-dsa/${userId}/sync-missing`).then(r => r.data);
