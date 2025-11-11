import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import api from './routes/index.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

export const app = express();

// Security and parsing middleware
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);

// Logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Routes
app.use('/api', api);

// 404 and error handling
app.use(notFound);
app.use(errorHandler);

export default app;
