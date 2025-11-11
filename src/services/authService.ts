import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET;
const JWT_TTL = '7d';

export async function signup(email: string, password: string) {
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'Email already registered');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_TTL });
  return { token, user: { id: user.id, email: user.email } };
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(401, 'Invalid credentials');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Invalid credentials');
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_TTL });
  return { token, user: { id: user.id, email: user.email } };
}
