import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  if (!env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGO_URI, {
    autoIndex: env.NODE_ENV !== 'production',
  });

  const conn = mongoose.connection;
  conn.on('connected', () => console.log('[db] Connected to MongoDB'));
  conn.on('error', (err) => console.error('[db] MongoDB error:', err));
  conn.on('disconnected', () => console.warn('[db] MongoDB disconnected'));

  return conn;
}

