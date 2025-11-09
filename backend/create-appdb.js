import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'database-1.c1oyy6o8cy72.us-east-2.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'Ea1128544093dd',
  database: 'postgres', // Connect to default postgres DB first
  ssl: {
    rejectUnauthorized: false
  }
});

async function createDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to RDS PostgreSQL');
    
    // Check if appdb already exists
    const checkResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'appdb'"
    );
    
    if (checkResult.rows.length > 0) {
      console.log('ℹ️  Database "appdb" already exists');
    } else {
      // CREATE DATABASE cannot be run inside a transaction block
      await client.query('CREATE DATABASE appdb');
      console.log('✅ Database "appdb" created successfully');
    }
    
    // Verify
    const verifyResult = await client.query(
      "SELECT datname FROM pg_database WHERE datname = 'appdb'"
    );
    console.log('✅ Verification:', verifyResult.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✅ Connection closed');
  }
}

createDatabase();
