import axios from 'axios';
import type { Receipt, Student, User } from './types';

type Credentials = { username: string; password: string };
type StudentPayload = Omit<Student, 'id'>;
type ReceiptPayload = {
  student_name?: string;
  student_id?: number;
  concept: string;
  category: string;
  amount_cash: number;
  amount_qr: number;
  total_amount: number;
};
type StatsParams = Record<string, any>;

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
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const login = (credentials: Credentials) => api.post('/login', credentials);
export const getStudents = () => api.get<Student[]>('/students');
export const createStudent = (data: StudentPayload) => api.post<Student>('/students', data);
export const getReceipts = (params: StatsParams) => api.get<Receipt[]>('/receipts', { params });
export const createReceipt = (data: ReceiptPayload) => api.post<Receipt>('/receipts', data);
export const cancelReceipt = (id: number, reason: string) => api.post(`/receipts/${id}/cancel`, { reason });
export const getStats = (params?: StatsParams) => api.get('/stats', { params });
export const getLastReceiptByName = (name: string) => api.get<Receipt>(`/students/last-receipt/${encodeURIComponent(name)}`);
export const getUsers = () => api.get<User[]>('/users');