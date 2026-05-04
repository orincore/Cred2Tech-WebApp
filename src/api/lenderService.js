import api from './axiosInstance';

export const getLenders = async () => {
  const { data } = await api.get('/admin/lenders');
  return data;
};

export const createLender = async (payload) => {
  const { data } = await api.post('/admin/lenders', payload);
  return data;
};

export const updateLender = async (id, payload) => {
  const { data } = await api.patch(`/admin/lenders/${id}`, payload);
  return data;
};

export const getLenderProducts = async (lenderId) => {
  const { data } = await api.get(`/admin/lenders/${lenderId}/products`);
  return data;
};

export const getProductMatrix = async (productId) => {
  const { data } = await api.get(`/admin/lenders/products/${productId}/matrix`);
  return data;
};

export const createLenderProduct = async (lenderId, payload) => {
  const { data } = await api.post(`/admin/lenders/${lenderId}/products`, payload);
  return data;
};

export const getSchemesByProduct = async (productId) => {
  const { data } = await api.get(`/admin/lenders/products/${productId}/schemes`);
  return data;
};

export const createScheme = async (productId, payload) => {
  const { data } = await api.post(`/admin/lenders/products/${productId}/schemes`, payload);
  return data;
};

export const updateScheme = async (schemeId, payload) => {
  const { data } = await api.patch(`/admin/lenders/schemes/${schemeId}`, payload);
  return data;
};

export const deleteScheme = async (schemeId) => {
  const { data } = await api.delete(`/admin/lenders/schemes/${schemeId}`);
  return data;
};

export const getParameterMaster = async () => {
  const { data } = await api.get('/admin/lenders/parameters/master');
  return data;
};

export const getSchemeParameters = async (schemeId) => {
  const { data } = await api.get(`/admin/lenders/schemes/${schemeId}/parameters`);
  return data;
};

export const updateSchemeParameter = async (schemeId, parameterId, valuePayload) => {
  const { data } = await api.put(`/admin/lenders/schemes/${schemeId}/parameters`, {
    parameter_id: parameterId,
    value: valuePayload
  });
  return data;
};
