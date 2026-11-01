import axiosInstance from './axiosInstance';

export const customerService = {
  createOrAttach: async (data) => {
    const response = await axiosInstance.post('/customers/create-or-attach', data);
    return response.data;
  },

  getCustomerProfile: async (customerId) => {
    const response = await axiosInstance.get(`/customers/${customerId}/profile`);
    return response.data;
  },

  getApiAvailability: async (customerId) => {
    const response = await axiosInstance.get(`/customers/${customerId}/api-availability`);
    return response.data;
  }
};
