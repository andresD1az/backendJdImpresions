import express from 'express';
import { setDefaultResultOrder } from 'node:dns';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import client from 'prom-client';
import rateLimit from 'express-rate-limit';
import { pool } from './config/db.js';
import { ensureDatabase } from './db/ensureDatabase.js';
import { runMigrations } from './db/runMigrations.js';
import authRouter, { devRouter } from './routes/auth.js';
import managerRouter from './routes/manager.js';
import storeRouter from './routes/store.js';

dotenv.config();

// Prefer IPv4 first to avoid ENETUNREACH when the platform lacks IPv6 routing
try { setDefaultResultOrder('ipv4first') } catch {}

const app = express();
// Behind reverse proxy (Docker/Compose/Nginx): trust only known private ranges
// This satisfies express-rate-limit validations and avoids permissive settings
app.set('trust proxy', [
  '127.0.0.1',           // loopback IPv4
  '::1',                 // loopback IPv6
  '10.0.0.0/8',          // private IPv4
  '172.16.0.0/12',       // Docker default bridge range
  '192.168.0.0/16'       // private IPv4
]);
// Seguridad HTTP
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
// CORS con allowlist
const allowed = new Set([process.env.FRONTEND_URL].filter(Boolean));
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, allowed.has(origin));
  },
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','authorization'],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Prometheus metrics: default process metrics
client.collectDefaultMetrics();
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.send(await client.register.metrics());
  } catch (e) {
    res.status(500).send('metrics_error');
  }
});

// HTTP request metrics (counter + duration histogram)
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method','route','status_code']
})
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method','route','status_code'],
  buckets: [0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5]
})
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path || req.path || 'unknown';
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, duration);
  });
  next();
});

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

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 100 });
const storeLimiter = rateLimit({ windowMs: 5*60*1000, max: 300 });

// Routes
app.use('/auth', authLimiter, authRouter);
// Dev/test helpers solo fuera de producción
if ((process.env.NODE_ENV || 'development') !== 'production') {
  app.use('/auth', devRouter);
}
// Admin/Manager endpoints (alias temporal durante transición)
app.use('/admin', managerRouter);
app.use('/manager', managerRouter);
// Also expose under /api/* to work behind proxies that prefix paths
app.use('/api/admin', managerRouter);
app.use('/api/manager', managerRouter);
// Store (client-facing) endpoints
app.use('/store', storeLimiter, storeRouter);
app.use('/api/store', storeLimiter, storeRouter);

// Start
app.listen(PORT, async () => {
  const runOnStart = (process.env.MIGRATIONS_ON_START ?? 'true').toLowerCase() === 'true';
  if (runOnStart) {
    try {
      // Ensure the database exists before running migrations
      await ensureDatabase();
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
