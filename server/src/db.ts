import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required to start the server. Set it in Render environment variables.');
}

// Using Pool for PostgreSQL instead of sqlite open
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for most cloud providers like Render/Railway
  }
});

export async function initDb() {
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

  // Create default users
  const createDefaultUser = async (username: string, pass: string, role: string, name: string) => {
    const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (res.rowCount === 0) {
      const hashedPassword = await bcrypt.hash(pass, 10);
      await pool.query(
        'INSERT INTO users (username, password, role, name) VALUES ($1, $2, $3, $4)',
        [username, hashedPassword, role, name]
      );
      console.log(`Default user created: ${username}`);
    }
  };

  await createDefaultUser('admin', 'admin123', 'admin', 'Administrador Principal');
  await createDefaultUser('biblioteca', 'biblio123', 'biblioteca', 'Cajero de Biblioteca');
  await createDefaultUser('caja', 'caja123', 'caja', 'Cajero de Mensualidades');
  await createDefaultUser('contador', 'conta123', 'contador', 'Contador / Auditor');

  return pool;
}
