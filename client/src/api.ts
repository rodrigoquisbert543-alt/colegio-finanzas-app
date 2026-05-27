import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  // FIX: usar %20 en vez de + para espacios en query params
  paramsSerializer: (params) => {
    const parts: string[] = [];
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    });
    return parts.join('&');
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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