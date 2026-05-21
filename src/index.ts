import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import fs from 'fs';

dotenv.config();

// ==========================================
// DATABASE LAYER
// ==========================================

// Unified Database Interface matching PG pool's query behavior
interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
}

// Custom Adapter for SQLite to mimic PostgreSQL Pool
class SqlitePool implements DatabaseConnection {
  private db: any;

  constructor(dbPath: string) {
    // Dynamically load sqlite3 to avoid loading native modules on Render if not needed
    let sqlite3;
    try {
      sqlite3 = require('sqlite3').verbose();
    } catch (e) {
      throw new Error('sqlite3 module not found. Run npm install sqlite3 locally.');
    }

    // Ensure the data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log(`🔌 Conectando a la base de datos local SQLite: ${dbPath}`);
    this.db = new sqlite3.Database(dbPath, (err: any) => {
      if (err) {
        console.error('❌ Error al abrir la base de datos SQLite:', err.message);
      } else {
        console.log('✅ Base de datos SQLite abierta correctamente.');
        // Enable foreign key support in SQLite
        this.db.run('PRAGMA foreign_keys = ON;');
      }
    });
  }

  public query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    return new Promise((resolve, reject) => {
      // Determine query type
      let processedSql = sql;
      let finalParams: any[] = [];

      // Mapping PostgreSQL specific syntax to SQLite
      processedSql = processedSql.replace(/ILIKE/gi, 'LIKE');
      processedSql = processedSql.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
      processedSql = processedSql.replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP');

      // 1. Check for ANY array clauses and expand them to standard IN clauses for SQLite
      // 2. Map $1, $2, ... placeholders to ?
      for (let i = 0; i < params.length; i++) {
        const param = params[i];
        const placeholder = `$${i + 1}`;

        if (Array.isArray(param)) {
          const inPlaceholders = param.map(() => '?').join(', ');
          const anyRegex = new RegExp(`=\\s*ANY\\s*\\(\\s*\\${placeholder}\\s*\\)`, 'gi');

          if (anyRegex.test(processedSql)) {
            processedSql = processedSql.replace(anyRegex, `IN (${inPlaceholders})`);
            finalParams.push(...param);
          } else {
            processedSql = processedSql.replace(placeholder, `(${inPlaceholders})`);
            finalParams.push(...param);
          }
        } else {
          processedSql = processedSql.replace(placeholder, '?');
          finalParams.push(param);
        }
      }

      // Convert any leftover PG placeholders to ? just in case
      processedSql = processedSql.replace(/\$\d+/g, '?');

      // Determine query type
      const isSelect = processedSql.trim().toUpperCase().startsWith('SELECT');

      if (isSelect) {
        this.db.all(processedSql, finalParams, (err: any, rows: any[]) => {
          if (err) {
            console.error('❌ SQLite SELECT Error:', err.message, '\nSQL:', processedSql, '\nParams:', finalParams);
            reject(err);
          } else {
            resolve({
              rows: rows || [],
              rowCount: rows ? rows.length : 0
            });
          }
        });
      } else {
        // Handle Postgres RETURNING clause in inserts for SQLite compatibility
        const isInsert = processedSql.trim().toUpperCase().startsWith('INSERT');
        const hasReturning = processedSql.toUpperCase().includes('RETURNING');

        if (isInsert && hasReturning) {
          const cleaningRegex = /\s*RETURNING\s+\w+/gi;
          const cleanSql = processedSql.replace(cleaningRegex, '');

          this.db.run(cleanSql, finalParams, function (this: any, err: any) {
            if (err) {
              console.error('❌ SQLite INSERT Error:', err.message, '\nSQL:', cleanSql, '\nParams:', finalParams);
              reject(err);
            } else {
              resolve({
                rows: [{ id: this.lastID }],
                rowCount: 1
              });
            }
          });
        } else {
          this.db.run(processedSql, finalParams, function (this: any, err: any) {
            if (err) {
              console.error('❌ SQLite EXEC Error:', err.message, '\nSQL:', processedSql, '\nParams:', finalParams);
              reject(err);
            } else {
              resolve({
                rows: [],
                rowCount: this.changes || 0
              });
            }
          });
        }
      }
    });
  }
}

let pool: DatabaseConnection;

async function initDb() {
  if (process.env.DATABASE_URL) {
    console.log('🔌 Conectando a la base de datos PostgreSQL en la nube...');
    const pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    pool = pgPool;
  } else {
    const dbPath = process.env.DB_PATH || './data/sige.db';
    pool = new SqlitePool(path.resolve(dbPath));
  }

  // Create Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'biblioteca', 'caja', 'contador')) NOT NULL,
      name TEXT NOT NULL
    )
  `);

  // Create Students table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      monthly_fee REAL DEFAULT 0
    )
  `);

  // Create Receipts table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id SERIAL PRIMARY KEY,
      folio TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      student_id INTEGER REFERENCES students(id),
      client_name TEXT,
      concept TEXT NOT NULL,
      category TEXT NOT NULL,
      amount_cash REAL DEFAULT 0,
      amount_qr REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('active', 'cancelled')) DEFAULT 'active',
      cancel_reason TEXT
    )
  `);

  // Create default users helper
  const createDefaultUser = async (username: string, pass: string, role: string, name: string) => {
    const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (res.rowCount === 0) {
      const hashedPassword = await bcrypt.hash(pass, 10);
      await pool.query(
        'INSERT INTO users (username, password, role, name) VALUES ($1, $2, $3, $4)',
        [username, hashedPassword, role, name]
      );
      console.log(`👤 Usuario por defecto creado: ${username}`);
    }
  };

  await createDefaultUser('admin', 'admin123', 'admin', 'Administrador Principal');
  await createDefaultUser('biblioteca', 'biblio123', 'biblioteca', 'Cajero de Biblioteca');
  await createDefaultUser('caja', 'caja123', 'caja', 'Cajero de Mensualidades');
  await createDefaultUser('contador', 'conta123', 'contador', 'Contador / Auditor');

  return pool;
}

// ==========================================
// EXPRESS SERVER
// ==========================================

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'production_secret_key';

app.use(cors());
app.use(express.json());

// Middleware de salud de la API
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', database: pool ? 'connected' : 'disconnected' });
});

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

// Login Route
app.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  console.log(`Intento de login para usuario: "${username}"`);
  
  if (!pool) return res.status(500).json({ message: 'Error: Base de datos no inicializada' });

  try {
    const resDb = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = resDb.rows[0];
    
    if (!user) {
      console.log(`Usuario "${username}" no encontrado en la base de datos.`);
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Comparación de contraseña para "${username}": ${isMatch ? 'EXITOSA' : 'FALLIDA'}`);

    if (isMatch) {
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
    } else {
      res.status(401).json({ message: 'Contraseña incorrecta' });
    }
  } catch (error) {
    console.error('Error en el proceso de login:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Students API
app.get('/api/students', authenticateToken, async (req: Request, res: Response) => {
  if (!pool) return res.status(500).json({ message: 'Sin conexión a base de datos' });
  const resDb = await pool.query('SELECT * FROM students ORDER BY name ASC');
  res.json(resDb.rows);
});

app.get('/api/students/last-receipt/:name', authenticateToken, async (req: Request, res: Response) => {
  if (!pool) return res.status(500).json({ message: 'Sin conexión a base de datos' });
  const { name } = req.params;
  const resDb = await pool.query(`
    SELECT r.* FROM receipts r
    JOIN students s ON r.student_id = s.id
    WHERE s.name ILIKE $1
    ORDER BY r.date DESC
    LIMIT 1
  `, [name]);
  res.json(resDb.rows[0] || null);
});

app.post('/api/students', authenticateToken, async (req: any, res: Response) => {
  if (!pool) return res.status(500).json({ message: 'Sin conexión a base de datos' });
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Solo administradores' });
  const { name, grade, monthly_fee } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM students WHERE name ILIKE $1', [name]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: 'Ya existe un estudiante con este nombre' });
    }
    await pool.query('INSERT INTO students (name, grade, monthly_fee) VALUES ($1, $2, $3)', [name, grade, monthly_fee]);
    res.status(201).json({ message: 'Estudiante creado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear estudiante' });
  }
});

// Receipts API
app.get('/api/receipts', authenticateToken, async (req: any, res: Response) => {
  if (!pool) return res.status(500).json({ message: 'Sin conexión a base de datos' });
  const { startDate, endDate, folio, studentId, category, studentName, userId: queryUserId } = req.query;
  const { id: currentUserId, role } = req.user;

  let query = `
    SELECT r.*, u.name as "userName", COALESCE(r.client_name, s.name, 'Cliente General') as "studentName" 
    FROM receipts r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN students s ON r.student_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (role === 'biblioteca' || role === 'caja') {
    params.push(currentUserId);
    query += ` AND r.user_id = $${params.length}`;
  }

  if (startDate) { params.push(startDate); query += ` AND r.date >= $${params.length}`; }
  if (endDate) { params.push(endDate + ' 23:59:59'); query += ` AND r.date <= $${params.length}`; }
  if (folio) { params.push(`%${folio}%`); query += ` AND r.folio ILIKE $${params.length}`; }
  if (studentId) { params.push(studentId); query += ` AND r.student_id = $${params.length}`; }

  if (role === 'admin' || role === 'contador') {
    const selectedUserId = queryUserId?.toString().trim();
    if (selectedUserId) {
      params.push(selectedUserId);
      query += ` AND r.user_id = $${params.length}`;
    }
  }

  if (category) {
    const categoryList = (category as string).split(',').map((c) => c.trim()).filter(Boolean);
    if (categoryList.length === 1) {
      params.push(categoryList[0]);
      query += ` AND r.category = $${params.length}`;
    } else if (categoryList.length > 1) {
      params.push(categoryList);
      query += ` AND r.category = ANY($${params.length})`;
    }
  }

  if (studentName) { 
    const search = `%${(studentName as string).trim()}%`;
    params.push(search);
    query += ` AND (s.name ILIKE $${params.length} OR r.client_name ILIKE $${params.length})`; 
  }

  query += ' ORDER BY r.date DESC';
  
  const resDb = await pool.query(query, params);
  res.json(resDb.rows);
});

app.post('/api/receipts', authenticateToken, async (req: any, res: Response) => {
  if (!pool) return res.status(500).json({ message: 'Sin conexión a base de datos' });
  const { role } = req.user;
  if (role !== 'biblioteca' && role !== 'caja') {
    return res.status(403).json({ message: 'Solo cajeros pueden emitir recibos' });
  }

  const { student_id, student_name, concept, category, amount_cash, amount_qr, total_amount } = req.body;
  
  try {
    let final_student_id = student_id;

    if (!final_student_id && student_name) {
      const existing = await pool.query('SELECT id FROM students WHERE name ILIKE $1', [student_name]);
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
  if (!pool) return res.status(500).json({ message: 'Sin conexión a base de datos' });
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

app.get('/api/stats', authenticateToken, async (req: any, res: Response) => {
  if (!pool) return res.status(500).json({ message: 'Sin conexión a base de datos' });
  const { startDate, endDate, userId: queryUserId, category, folio, studentName } = req.query;
  const { id: currentUserId, role } = req.user;

  let targetUserId = queryUserId;
  if ((role === 'biblioteca' || role === 'caja') && !queryUserId) {
    targetUserId = currentUserId;
  }

  let query = `
    SELECT 
      SUM(CASE WHEN status = 'active' AND category LIKE 'Ingreso%' THEN total_amount ELSE 0 END) as income_total,
      SUM(CASE WHEN status = 'active' AND category LIKE 'Egreso%' THEN total_amount ELSE 0 END) as expense_total,
      
      SUM(CASE WHEN status = 'active' AND category LIKE 'Ingreso%' THEN amount_cash ELSE 0 END) as income_cash_total,
      SUM(CASE WHEN status = 'active' AND category LIKE 'Ingreso%' THEN amount_qr ELSE 0 END) as income_qr_total,

      SUM(CASE WHEN status = 'active' AND category LIKE 'Egreso%' THEN amount_cash ELSE 0 END) as expense_cash_total,
      SUM(CASE WHEN status = 'active' AND category LIKE 'Egreso%' THEN amount_qr ELSE 0 END) as expense_qr_total
    FROM receipts r
    LEFT JOIN students s ON r.student_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (startDate) { params.push(startDate); query += ` AND r.date >= $${params.length}`; }
  if (endDate) { params.push(endDate + ' 23:59:59'); query += ` AND r.date <= $${params.length}`; }
  if (targetUserId) { params.push(targetUserId); query += ` AND r.user_id = $${params.length}`; }
  if (folio) { params.push(`%${folio}%`); query += ` AND r.folio ILIKE $${params.length}`; }
  if (studentName) { 
    const search = `%${(studentName as string).trim()}%`;
    params.push(search);
    query += ` AND (s.name ILIKE $${params.length} OR r.client_name ILIKE $${params.length})`; 
  }
  
  if (category) {
    const categories = (category as string).split(',').map((c) => c.trim()).filter(Boolean);
    if (categories.length > 0) {
      params.push(categories);
      query += ` AND r.category = ANY($${params.length})`;
    }
  }

  const resDb = await pool.query(query, params);
  res.json(resDb.rows[0]);
});

app.get('/api/users', authenticateToken, async (req: Request, res: Response) => {
  if (!pool) return res.status(500).json({ message: 'Sin conexión a base de datos' });
  const resDb = await pool.query('SELECT id, username, name, role FROM users WHERE role IN (\'caja\', \'biblioteca\')');
  res.json(resDb.rows);
});

// ==========================================
// SERVIR ARCHIVOS ESTÁTICOS (FRONTEND)
// ==========================================
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Catch-all route para SPA (Single Page Application)
app.get(/.*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Error handling middleware global
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error capturado:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==========================================
// ARRANQUE ASÍNCRONO DEL SERVIDOR
// ==========================================
async function startServer() {
  try {
    console.log('Intentando conectar con la base de datos PostgreSQL...');
    pool = await initDb();
    console.log('✅ Conexión inicializada con éxito.');
  } catch (error) {
    console.error('❌ ERROR CRÍTICO al inicializar la base de datos:', error);
    console.log('Iniciando el servidor en modo de contingencia...');
  }

  // Ejecutamos listen usando la interfaz global '0.0.0.0' requerida por Render
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 ====================================================`);
    console.log(`🚀 SERVIDOR ESCUCHANDO EN EL PUERTO EN LA NUBE: ${PORT}`);
    console.log(`🚀 ====================================================`);
  });
}

// Iniciar el servidor
startServer();
