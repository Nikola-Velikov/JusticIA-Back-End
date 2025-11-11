import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import chatRoutes from './chatRoutes.js';

const api = Router();

api.use(healthRoutes);
api.use(authRoutes);
api.use(chatRoutes);

export default api;
