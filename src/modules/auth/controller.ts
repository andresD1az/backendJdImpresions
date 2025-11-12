import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

// Mock database - en producción usar DB real
const users: any[] = [
  {
    id: 1,
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
    role: 'customer',
    failedAttempts: 0,
  },
  {
    id: 2,
    email: 'manager@example.com',
    password: 'password123',
    name: 'Manager User',
    role: 'manager',
    failedAttempts: 0,
  },
];

const blacklistedTokens = new Set<string>();

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    const user = users.find((u) => u.email === email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if account is blocked
    if (user.failedAttempts >= 5) {
      return res.status(403).json({
        success: false,
        message: 'Account locked due to too many failed attempts',
      });
    }

    if (user.password !== password) {
      user.failedAttempts++;
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Reset failed attempts on successful login
    user.failedAttempts = 0;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, role } = req.body;

    // Validate password strength
    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // Check for weak passwords
    const weakPasswords = ['123', 'abc', 'password', '12345678'];
    if (weakPasswords.includes(password.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Password is too weak',
      });
    }

    // Check if user exists
    if (users.find((u) => u.email === email)) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    const newUser = {
      id: users.length + 1,
      email,
      password,
      name,
      role: role || 'customer',
      failedAttempts: 0,
    };

    users.push(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    // Simulate sending email (in production, send real email)
    res.json({
      success: true,
      message: 'Password reset link sent to email',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      blacklistedTokens.add(token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    // Check if token is blacklisted
    if (blacklistedTokens.has(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated',
      });
    }

    try {
      const decoded: any = jwt.verify(token, config.jwtSecret);
      const user = users.find((u) => u.id === decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}
