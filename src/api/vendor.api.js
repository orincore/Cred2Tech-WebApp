import api from '../api/axiosInstance';

export const getVendors = async () => {
  const response = await api.get('/admin/vendors');
  return response.data;
};

export const updateVendor = async (id, data) => {
  const response = await api.put(`/admin/vendors/${id}`, data);
  return response.data;
};

export const updateVendorSlabs = async (id, slabs) => {
  const response = await api.put(`/admin/vendors/${id}/slabs`, { slabs });
  return response.data;
};
