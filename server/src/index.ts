import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { initDb } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'production_secret_key';

app.use(cors());
app.use(express.json());

// Auth Middleware
export const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token required' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

async function startServer() {
  const pool = await initDb();

  // Login Route
  app.post('/api/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
      const resDb = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = resDb.rows[0];
      if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role, name: user.name },
          JWT_SECRET,
          { expiresIn: '8h' }
        );
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
      } else {
        res.status(401).json({ message: 'Credenciales inválidas' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error en el servidor' });
    }
  });

  // Students API
  app.get('/api/students', authenticateToken, async (req: Request, res: Response) => {
    const resDb = await pool.query('SELECT * FROM students ORDER BY name ASC');
    res.json(resDb.rows);
  });

  app.get('/api/students/last-receipt/:name', authenticateToken, async (req: Request, res: Response) => {
    const { name } = req.params;
    const resDb = await pool.query(`
      SELECT r.* 
      FROM receipts r
      JOIN students s ON r.student_id = s.id
      WHERE s.name = $1
      ORDER BY r.date DESC
      LIMIT 1
    `, [name]);
    res.json(resDb.rows[0] || null);
  });

  app.post('/api/students', authenticateToken, async (req: any, res: Response) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Solo administradores' });
    const { name, grade, monthly_fee } = req.body;
    try {
      await pool.query('INSERT INTO students (name, grade, monthly_fee) VALUES ($1, $2, $3)', [name, grade, monthly_fee]);
      res.status(201).json({ message: 'Estudiante creado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al crear estudiante' });
    }
  });

  // Receipts API
  app.get('/api/receipts', authenticateToken, async (req: Request, res: Response) => {
    const { startDate, endDate, folio, studentId, category, studentName } = req.query;
    let query = `
      SELECT r.*, u.name as "userName", COALESCE(r.client_name, s.name, 'Cliente General') as "studentName" 
      FROM receipts r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN students s ON r.student_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) { params.push(startDate); query += ` AND r.date >= $${params.length}`; }
    if (endDate) { params.push(endDate + ' 23:59:59'); query += ` AND r.date <= $${params.length}`; }
    if (folio) { params.push(`%${folio}%`); query += ` AND r.folio LIKE $${params.length}`; }
    if (studentId) { params.push(studentId); query += ` AND r.student_id = $${params.length}`; }
    if (category) { params.push(category); query += ` AND r.category = $${params.length}`; }
    if (studentName) { 
      params.push(`%${studentName}%`);
      query += ` AND (s.name LIKE $${params.length} OR r.client_name LIKE $${params.length})`; 
    }

    query += ' ORDER BY r.date DESC';
    
    const resDb = await pool.query(query, params);
    res.json(resDb.rows);
  });

  app.post('/api/receipts', authenticateToken, async (req: any, res: Response) => {
    const { role } = req.user;
    if (role !== 'biblioteca' && role !== 'caja') {
      return res.status(403).json({ message: 'Solo cajeros pueden emitir recibos' });
    }

    const { student_id, student_name, concept, category, amount_cash, amount_qr, total_amount } = req.body;
    
    try {
      let final_student_id = student_id;

      if (!final_student_id && student_name) {
        const existing = await pool.query('SELECT id FROM students WHERE name = $1', [student_name]);
        if (existing.rowCount! > 0) {
          final_student_id = existing.rows[0].id;
        } else {
          const result = await pool.query('INSERT INTO students (name, grade) VALUES ($1, $2) RETURNING id', [student_name, 'General']);
          final_student_id = result.rows[0].id;
        }
      }

      const date = new Date();
      const folio = `REC-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      const result = await pool.query(
        `INSERT INTO receipts (folio, user_id, student_id, client_name, concept, category, amount_cash, amount_qr, total_amount) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [folio, req.user.id, final_student_id || null, student_name || null, concept, category, amount_cash || 0, amount_qr || 0, total_amount]
      );

      res.status(201).json({ id: result.rows[0].id, folio });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al generar comprobante' });
    }
  });

  app.post('/api/receipts/:id/cancel', authenticateToken, async (req: any, res: Response) => {
    const { role } = req.user;
    if (role !== 'biblioteca' && role !== 'caja' && role !== 'admin') {
      return res.status(403).json({ message: 'No tiene permisos para anular comprobantes' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    try {
      await pool.query(
        'UPDATE receipts SET status = \'cancelled\', cancel_reason = $1 WHERE id = $2',
        [reason, id]
      );
      res.json({ message: 'Comprobante anulado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al anular comprobante' });
    }
  });

  app.get('/api/stats', authenticateToken, async (req: Request, res: Response) => {
    const { startDate, endDate, userId } = req.query;
    let query = `
      SELECT 
        SUM(CASE WHEN status = 'active' AND category LIKE 'Ingreso%' THEN total_amount ELSE 0 END) as income_total,
        SUM(CASE WHEN status = 'active' AND category LIKE 'Egreso%' THEN total_amount ELSE 0 END) as expense_total,
        SUM(CASE WHEN status = 'active' AND category LIKE 'Ingreso%' THEN amount_cash ELSE 0 END) - 
        SUM(CASE WHEN status = 'active' AND category LIKE 'Egreso%' THEN amount_cash ELSE 0 END) as cash_balance,
        SUM(CASE WHEN status = 'active' AND category LIKE 'Ingreso%' THEN amount_qr ELSE 0 END) -
        SUM(CASE WHEN status = 'active' AND category LIKE 'Egreso%' THEN amount_qr ELSE 0 END) as qr_balance
      FROM receipts
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) { params.push(startDate); query += ` AND date >= $${params.length}`; }
    if (endDate) { params.push(endDate + ' 23:59:59'); query += ` AND date <= $${params.length}`; }
    if (userId) { params.push(userId); query += ` AND user_id = $${params.length}`; }

    const resDb = await pool.query(query, params);
    res.json(resDb.rows[0]);
  });

  app.get('/api/users', authenticateToken, async (req: Request, res: Response) => {
    const resDb = await pool.query('SELECT id, username, name, role FROM users WHERE role IN (\'caja\', \'biblioteca\')');
    res.json(resDb.rows);
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
