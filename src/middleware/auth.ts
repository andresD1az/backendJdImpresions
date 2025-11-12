import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware to verify JWT token
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as {
        id: string;
        email: string;
        role: string;
      };

      req.user = decoded;
      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
}

/**
 * Middleware to check if user is admin/manager
 */
export function requireManager(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated',
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
    });
  }

  next();
}
