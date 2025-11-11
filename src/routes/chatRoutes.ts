import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { getChats, getMessages, postChat, postSend, postEdit, removeChat, removeMessage, validateCreateChat, validateSend, validateEdit } from '../controllers/chatController.js';

const router = Router();

router.use(requireAuth);

router.get('/chats', getChats);
router.post('/chats', validateCreateChat, postChat);
router.delete('/chats/:id', removeChat);

router.get('/chats/:id/messages', getMessages);
router.post('/chats/:id/messages/send', validateSend, postSend);
router.post('/chats/:id/messages/edit', validateEdit, postEdit);
router.delete('/chats/:id/messages/:messageId', removeMessage);

export default router;
