import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8080', 10),
  MONGO_URI: process.env.MONGO_URI || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  GENERATE_URL: process.env.GENERATE_URL || 'https://web-production-d8499.up.railway.app/generate',
};

if (!env.MONGO_URI) {
  // Do not throw here to allow the app to start without DB in some environments
  console.warn('[env] MONGO_URI is not set. Database connection will fail.');
}
