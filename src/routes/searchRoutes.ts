import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { postSearch, validateSearch } from '../controllers/searchController.js';

const router = Router();

router.post('/search', requireAuth, validateSearch, postSearch);

export default router;
