import type { Request, Response } from 'express';
import { z } from 'zod';
import { login, signup } from '../services/authService.js';
import { validateBody } from '../middlewares/validateRequest.js';

const credSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export const validateCreds = validateBody(credSchema);

export async function postSignup(req: Request, res: Response) {
  const { email, password } = (req as any).validatedBody as z.infer<typeof credSchema>;
  const result = await signup(email, password);
  res.status(201).json(result);
}

export async function postLogin(req: Request, res: Response) {
  const { email, password } = (req as any).validatedBody as z.infer<typeof credSchema>;
  const result = await login(email, password);
  res.status(200).json(result);
}

export async function getMe(req: Request, res: Response) {
  res.status(200).json({ user: req.user });
}

