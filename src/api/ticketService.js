import api from './axiosInstance';

const orgParams = (orgId) => (orgId ? { params: { org_id: orgId } } : undefined);

export const ticketService = {
  // Submitter (MSME + DSA/staff)
  create: async (formData) => {
    const res = await api.post('/tickets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  listMine: async () => {
    const res = await api.get('/tickets/mine');
    return res.data.data;
  },
  // `orgId`: a white-label organisation's ticket lives in that organisation's own database (admin screens pass it; the
  // submitter screens never do, so they only ever see their own database).
  getById: async (id, orgId) => {
    const res = await api.get(`/tickets/${id}`, orgParams(orgId));
    return res.data.data;
  },
  addMessage: async (id, note) => {
    const res = await api.post(`/tickets/${id}/messages`, { note });
    return res.data.data;
  },
  attachmentUrl: (ticketId, attachmentId) => {
    // axiosInstance attaches the Bearer token via interceptor for API calls,
    // but a plain <a href> download bypasses that — so attachment downloads
    // go through downloadAttachment() below instead of this URL directly.
    return `${api.defaults.baseURL}/tickets/${ticketId}/attachments/${attachmentId}`;
  },
  downloadAttachment: async (ticketId, attachmentId, fileName, orgId) => {
    const res = await api.get(`/tickets/${ticketId}/attachments/${attachmentId}`, { responseType: 'blob', ...(orgId ? { params: { org_id: orgId } } : {}) });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || 'attachment');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  // For inline <img> thumbnails — the plain attachmentUrl() above can't be
  // used directly in an <img src> since the download route needs the Bearer
  // token, which only the axios interceptor attaches. Caller owns the
  // returned object URL and must revoke it on unmount (see AttachmentGallery).
  fetchAttachmentPreview: async (ticketId, attachmentId, orgId) => {
    const res = await api.get(`/tickets/${ticketId}/attachments/${attachmentId}`, { responseType: 'blob', ...(orgId ? { params: { org_id: orgId } } : {}) });
    return window.URL.createObjectURL(res.data);
  },

  // Admin
  // `org_id: 'all'`: the main app AND every white-label organisation together (each row names its organisation).
  listForAdmin: async (params) => {
    const res = await api.get('/tickets', { params: { org_id: 'all', ...params } });
    return res.data;
  },
  unreadCount: async () => {
    const res = await api.get('/tickets/unread-count', { params: { org_id: 'all' } });
    return res.data.count;
  },
  changeStatus: async (id, status, note, orgId) => {
    const res = await api.patch(`/tickets/${id}/status`, { status, note }, orgParams(orgId));
    return res.data.data;
  },
  addNote: async (id, note, orgId) => {
    const res = await api.post(`/tickets/${id}/notes`, { note }, orgParams(orgId));
    return res.data.data;
  },
  reply: async (id, note, orgId) => {
    const res = await api.post(`/tickets/${id}/reply`, { note }, orgParams(orgId));
    return res.data.data;
  },
  markAsRead: async (id, orgId) => {
    const res = await api.post(`/tickets/${id}/read`, undefined, orgParams(orgId));
    return res.data.data;
  },

  // Admin — notification recipients (To/Cc list)
  listRecipients: async () => {
    const res = await api.get('/admin/ticket-recipients');
    return res.data.data;
  },
  addRecipient: async (payload) => {
    const res = await api.post('/admin/ticket-recipients', payload);
    return res.data.data;
  },
  updateRecipient: async (id, payload) => {
    const res = await api.put(`/admin/ticket-recipients/${id}`, payload);
    return res.data.data;
  },
  removeRecipient: async (id) => {
    await api.delete(`/admin/ticket-recipients/${id}`);
  },
};
