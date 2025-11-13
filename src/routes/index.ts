import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import chatRoutes from './chatRoutes.js';
import caseRoutes from './caseRoutes.js';

const api = Router();

api.use(healthRoutes);
api.use(authRoutes);
api.use(chatRoutes);
api.use('/cases', caseRoutes);

export default api;
