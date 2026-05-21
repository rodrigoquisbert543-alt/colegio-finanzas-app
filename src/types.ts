export interface User {
  id: number;
  username: string;
  role: 'admin' | 'biblioteca' | 'caja' | 'contador';
  name: string;
}

export interface Student {
  id: number;
  name: string;
  grade: string;
  monthly_fee: number;
}

export interface Receipt {
  id: number;
  folio: string;
  user_id: number;
  student_id?: number;
  concept: string;
  category: string;
  amount_cash: number;
  amount_qr: number;
  total_amount: number;
  date: string;
  status: 'active' | 'cancelled';
  cancel_reason?: string;
  userName?: string; // Joined field
  studentName?: string; // Joined field
}
