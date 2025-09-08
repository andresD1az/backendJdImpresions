import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const connectionString = process.env.DATABASE_URL;

function buildPool() {
  if (connectionString) {
    // Enable SSL for managed providers (e.g., Supabase). When using
    // a connection string with sslmode=require, node-postgres still
    // needs the ssl option object to avoid self-signed errors on Windows.
    const isManaged = /supabase\.co|render\.com|railway\.app/i.test(connectionString);
    let cs = connectionString;
    if (isManaged) {
      // Normalize sslmode to no-verify to avoid chain issues on some Windows setups
      if (/sslmode=/i.test(cs)) {
        cs = cs.replace(/sslmode=([^&]+)/i, 'sslmode=no-verify');
      } else {
        cs += (cs.includes('?') ? '&' : '?') + 'sslmode=no-verify';
      }
    }
    const sslOption = isManaged || process.env.DB_SSL_ALLOW_SELF_SIGNED === 'true'
      ? { rejectUnauthorized: false }
      : undefined;
    return new Pool({ connectionString: cs, ssl: sslOption });
  }
  return new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'app_db',
  });
}

export const pool = buildPool();

export async function query(text, params) {
  return pool.query(text, params);
}
