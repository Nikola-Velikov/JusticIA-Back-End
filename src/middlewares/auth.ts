import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  // Always allow CORS preflight to pass through
  if (req.method === 'OPTIONS') return next();
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return next(new ApiError(401, 'Unauthorized'));
  }
  const token = match[1].trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser & { iat: number; exp: number };
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch {
    return next(new ApiError(401, 'Invalid token'));
  }
}
