import api from './axiosInstance';

// Document storage for the signed-in account (2 GB free, paid plans above that).
// Usage is visible to everyone in the account; buying/changing/cancelling a plan
// is DSA_ADMIN-only on the server.
export const storageService = {
  status: async () => (await api.get('/storage/status')).data,
  // Manage storage (DSA_ADMIN): every stored file grouped by case, and a delete that
  // also removes the file from S3 so the space is freed.
  files: async () => (await api.get('/storage/files')).data,
  deleteFiles: async (documentIds) => (await api.post('/storage/files/delete', { document_ids: documentIds })).data,
  // One zip of the selected files (a backup before deleting). Resolves to the zip as a Blob.
  downloadFiles: async (documentIds) => {
    try {
      const res = await api.post('/storage/files/download', { document_ids: documentIds }, { responseType: 'blob' });
      const m = /filename="?([^";]+)"?/i.exec(res.headers['content-disposition'] || '');
      return { blob: res.data, fileName: m ? m[1] : 'cred2tech-files.zip', count: Number(res.headers['x-zip-file-count']) || documentIds.length };
    } catch (err) {
      // An error body arrives as a Blob because of responseType; turn it back into the JSON message.
      if (err.response?.data instanceof Blob) {
        try { err.response.data = JSON.parse(await err.response.data.text()); } catch { /* keep the generic error */ }
      }
      throw err;
    }
  },
  subscribe: async (planGb) => (await api.post('/storage/subscribe', { plan_gb: planGb })).data,
  confirm: async (payload) => (await api.post('/storage/confirm', payload)).data,
  upgrade: async (planGb) => (await api.post('/storage/upgrade', { plan_gb: planGb })).data,
  confirmUpgrade: async (payload) => (await api.post('/storage/confirm-upgrade', payload)).data,
  downgrade: async (planGb) => (await api.post('/storage/downgrade', { plan_gb: planGb })).data,
  cancel: async () => (await api.post('/storage/cancel')).data,
};

export default storageService;
