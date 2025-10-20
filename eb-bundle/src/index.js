import express from 'express';
import { setDefaultResultOrder } from 'node:dns';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './config/db.js';
import { runMigrations } from './db/runMigrations.js';
import authRouter, { devRouter } from './routes/auth.js';
import managerRouter from './routes/manager.js';

dotenv.config();

// Prefer IPv4 first to avoid ENETUNREACH when the platform lacks IPv6 routing
try { setDefaultResultOrder('ipv4first') } catch {}

const app = express();
// CORS con preflight y cabeceras personalizadas (Authorization)
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','authorization'],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// Fallback headers in case any proxy strips CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
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
// Dev/test helpers (e.g., /auth/email-test)
app.use('/auth', devRouter);
// Manager endpoints
app.use('/manager', managerRouter);

// Start
app.listen(PORT, async () => {
  const runOnStart = (process.env.MIGRATIONS_ON_START ?? 'true').toLowerCase() === 'true';
  if (runOnStart) {
    try {
      await runMigrations();
      console.log('Migrations applied.');
    } catch (e) {
      console.error('Migration error:', e.message);
    }
  } else {
    console.log('Migrations skipped on start (MIGRATIONS_ON_START=false).');
  }
  console.log(`API listening on http://localhost:${PORT}`);
});
