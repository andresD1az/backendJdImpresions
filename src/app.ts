import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import uploadsRouter from './modules/uploads/router';
import { authMiddleware, requireManager } from './middleware/auth';

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

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
