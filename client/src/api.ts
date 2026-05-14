import axios from 'axios';

// IMPORTANT: When deploying to Render, the VITE_API_URL should be the full URL of your backend.
// Example: https://colegio-finanzas-api.onrender.com/api
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const login = (credentials: any) => api.post('/login', credentials);
export const getStudents = () => api.get('/students');
export const createStudent = (data: any) => api.post('/students', data);
export const getReceipts = (params: any) => api.get('/receipts', { params });
export const createReceipt = (data: any) => api.post('/receipts', data);
export const cancelReceipt = (id: number, reason: string) => api.post(`/receipts/${id}/cancel`, { reason });
export const getStats = (params?: any) => api.get('/stats', { params });
export const getLastReceiptByName = (name: string) => api.get(`/students/last-receipt/${encodeURIComponent(name)}`);
export const getUsers = () => api.get('/users');
