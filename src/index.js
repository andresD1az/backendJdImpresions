import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './config/db.js';
import { runMigrations } from './db/runMigrations.js';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Health
app.get('/health', async (req, res) => {
  const status = { status: 'ok', time: new Date().toISOString() };
  try {
    await pool.query('SELECT 1');
    status.db = 'ok';
  } catch (e) {
    status.db = 'error';
    status.db_error = e.message;
  }
  res.json(status);
});

// Routes
app.use('/auth', authRouter);

// Start
app.listen(PORT, async () => {
  try {
    await runMigrations();
    console.log('Migrations applied.');
  } catch (e) {
    console.error('Migration error:', e.message);
  }
  console.log(`API listening on http://localhost:${PORT}`);
});
