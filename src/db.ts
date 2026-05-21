import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Unified Database Interface matching PG pool's query behavior
export interface DatabaseConnection {
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

export async function initDb() {
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
