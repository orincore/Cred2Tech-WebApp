import axiosInstance from './axiosInstance';

export const otpService = {
  sendOtp: async (data) => {
    const response = await axiosInstance.post('/otp/send', data);
    return response.data;
  },

  verifyOtp: async (data) => {
    const response = await axiosInstance.post('/otp/verify', data);
    return response.data;
  },

  resendOtp: async (data) => {
    const response = await axiosInstance.post('/otp/resend', data);
    return response.data;
  }
};
