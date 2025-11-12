import { Request, Response, NextFunction } from 'express';

// Middleware para capturar métricas de rendimiento
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Capturar cuando la respuesta termina
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };

    // Log en formato estructurado para Azure Application Insights
    console.log(JSON.stringify({
      eventType: 'REQUEST_COMPLETED',
      metrics: logEntry,
    }));

    // Métricas específicas de negocio
    if (req.path.includes('/auth/login')) {
      console.log(JSON.stringify({
        eventType: 'BUSINESS_METRIC',
        metric: 'LOGIN_TIME',
        value: duration,
        threshold: 100, // ms
        passed: duration < 100,
      }));
    }

    if (req.path.includes('/sales')) {
      console.log(JSON.stringify({
        eventType: 'BUSINESS_METRIC',
        metric: 'SALES_OPERATION_TIME',
        value: duration,
        threshold: 500, // ms
        passed: duration < 500,
      }));
    }

    // Alertas de rendimiento
    if (duration > 1000) {
      console.warn(JSON.stringify({
        eventType: 'PERFORMANCE_WARNING',
        message: 'Slow request detected',
        duration,
        path: req.path,
      }));
    }

    // Alertas de errores
    if (res.statusCode >= 500) {
      console.error(JSON.stringify({
        eventType: 'ERROR_ALERT',
        message: 'Server error occurred',
        statusCode: res.statusCode,
        path: req.path,
      }));
    }
  });

  next();
}

// Métricas agregadas en memoria (para endpoints de health check)
export class MetricsCollector {
  private static requestCount = 0;
  private static errorCount = 0;
  private static totalDuration = 0;
  private static requestsByEndpoint: Record<string, number> = {};

  static increment(path: string, duration: number, statusCode: number) {
    this.requestCount++;
    this.totalDuration += duration;
    
    if (statusCode >= 400) {
      this.errorCount++;
    }

    this.requestsByEndpoint[path] = (this.requestsByEndpoint[path] || 0) + 1;
  }

  static getMetrics() {
    const avgDuration = this.requestCount > 0 
      ? Math.round(this.totalDuration / this.requestCount) 
      : 0;

    return {
      totalRequests: this.requestCount,
      errorRate: this.requestCount > 0 
        ? ((this.errorCount / this.requestCount) * 100).toFixed(2) + '%'
        : '0%',
      averageResponseTime: `${avgDuration}ms`,
      topEndpoints: Object.entries(this.requestsByEndpoint)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([path, count]) => ({ path, count })),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  static reset() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalDuration = 0;
    this.requestsByEndpoint = {};
  }
}
