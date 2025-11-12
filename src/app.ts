import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import uploadsRouter from './modules/uploads/router';
import authRouter from './modules/auth/router';
import salesRouter from './modules/sales/router';
import productsRouter from './modules/products/router';
import customersRouter from './modules/customers/router';
import { authMiddleware, requireManager } from './middleware/auth';
import { metricsMiddleware, MetricsCollector } from './middleware/metrics';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Metrics middleware (before routes)
app.use(metricsMiddleware);

// Root endpoint - API Info
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'JD Impresión API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      auth: {
        login: 'POST /auth/login',
        register: 'POST /auth/register',
        profile: 'GET /auth/profile',
        logout: 'POST /auth/logout',
        forgotPassword: 'POST /auth/forgot-password'
      },
      products: {
        list: 'GET /products',
        get: 'GET /products/:id'
      },
      sales: {
        list: 'GET /sales',
        get: 'GET /sales/:id',
        create: 'POST /sales',
        cancel: 'POST /sales/:id/cancel',
        invoice: 'GET /sales/:id/invoice'
      },
      customers: {
        sales: 'GET /customers/:id/sales'
      }
    },
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    status: 'ok',
    metrics: MetricsCollector.getMetrics(),
    timestamp: new Date().toISOString(),
  });
});

// Public routes
app.use('/auth', authRouter);
app.use('/sales', salesRouter);
app.use('/products', productsRouter);
app.use('/customers', customersRouter);

// Manager routes (protected with authentication)
app.use('/manager', authMiddleware, requireManager, uploadsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  // Handle multer errors
  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  if (err.message.includes('File too large')) {
    return res.status(400).json({
      success: false,
      error: 'File size exceeds 10MB limit',
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

export default app;
