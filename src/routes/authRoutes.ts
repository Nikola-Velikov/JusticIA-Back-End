import { Router } from 'express';
import { getMe, postLogin, postSignup, validateCreds } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/auth/signup', validateCreds, postSignup);
router.post('/auth/login', validateCreds, postLogin);
router.get('/auth/me', requireAuth, getMe);

export default router;

