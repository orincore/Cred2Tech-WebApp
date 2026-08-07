import api from './axiosInstance';

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
  getById: async (id) => {
    const res = await api.get(`/tickets/${id}`);
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
  downloadAttachment: async (ticketId, attachmentId, fileName) => {
    const res = await api.get(`/tickets/${ticketId}/attachments/${attachmentId}`, { responseType: 'blob' });
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
  fetchAttachmentPreview: async (ticketId, attachmentId) => {
    const res = await api.get(`/tickets/${ticketId}/attachments/${attachmentId}`, { responseType: 'blob' });
    return window.URL.createObjectURL(res.data);
  },

  // Admin
  listForAdmin: async (params) => {
    const res = await api.get('/tickets', { params });
    return res.data;
  },
  unreadCount: async () => {
    const res = await api.get('/tickets/unread-count');
    return res.data.count;
  },
  changeStatus: async (id, status, note) => {
    const res = await api.patch(`/tickets/${id}/status`, { status, note });
    return res.data.data;
  },
  addNote: async (id, note) => {
    const res = await api.post(`/tickets/${id}/notes`, { note });
    return res.data.data;
  },
  reply: async (id, note) => {
    const res = await api.post(`/tickets/${id}/reply`, { note });
    return res.data.data;
  },
  markAsRead: async (id) => {
    const res = await api.post(`/tickets/${id}/read`);
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
