import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

/**
 * Ensures the target database exists by connecting to the default 'postgres' database
 * and creating it if necessary. This is needed because RDS doesn't create custom
 * databases automatically.
 */
export async function ensureDatabase() {
  const targetDb = process.env.PGDATABASE || 'appdb';
  
  // Skip if DATABASE_URL is set (assume it's already pointing to the right DB)
  if (process.env.DATABASE_URL) {
    console.log('[ensureDatabase] Using DATABASE_URL, skipping database creation check');
    return;
  }
  
  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: 'postgres', // Connect to default postgres DB
    ssl: process.env.DB_SSL_ALLOW_SELF_SIGNED === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await client.connect();
    console.log(`[ensureDatabase] Connected to postgres database`);
    
    // Check if target database exists
    const checkResult = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`[ensureDatabase] Database "${targetDb}" already exists ✓`);
    } else {
      // CREATE DATABASE cannot be run in a transaction
      await client.query(`CREATE DATABASE ${targetDb}`);
      console.log(`[ensureDatabase] Database "${targetDb}" created successfully ✓`);
    }
  } catch (error) {
    console.error('[ensureDatabase] Error:', error.message);
    // Don't throw - let the app continue and fail later if DB is truly missing
  } finally {
    await client.end();
  }
}
