import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { getCases, postCase, patchCase, delCase, postCaseChat, delCaseChat } from '../controllers/caseController.js';

const router = Router();

router.use(requireAuth);
router.get('/', getCases);
router.post('/', postCase);
router.patch('/:id', patchCase);
router.delete('/:id', delCase);
router.post('/:id/chats', postCaseChat);
router.delete('/:id/chats/:chatId', delCaseChat);

export default router;
