import api from './axiosInstance';

export const getPddTasks = async (params) => {
  const response = await api.get('/pdd-tasks', { params });
  return response.data;
};

export const updatePddStatus = async (id, payload) => {
  const response = await api.patch(`/pdd-tasks/${id}/status`, payload);
  return response.data;
};
