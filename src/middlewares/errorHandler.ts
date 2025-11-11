import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: 'Not Found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const isApiError = err instanceof ApiError;
  const status = isApiError ? err.status : 500;
  const message = isApiError ? err.message : 'Internal Server Error';

  // Surface validation error messages if present
  const details = isApiError ? err.details : undefined;

  if (!isApiError) {
    console.error('[unhandled-error]', err);
  }

  res.status(status).json({ error: message, details });
}

