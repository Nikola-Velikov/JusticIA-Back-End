import type { Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middlewares/validateRequest.js';
import { addUserAndAssistantMessage, createChat, deleteChat, listChats, listMessages, editAndResend, deleteSingleMessage } from '../services/chatService.js';

export async function getChats(req: Request, res: Response) {
  const chats = await listChats(req.user!.id);
  res.json(chats);
}

const createChatSchema = z.object({ title: z.string().trim().min(1).optional() });
export const validateCreateChat = validateBody(createChatSchema);
export async function postChat(req: Request, res: Response) {
  const { title } = (req as any).validatedBody as z.infer<typeof createChatSchema>;
  const chat = await createChat(req.user!.id, title);
  res.status(201).json(chat);
}

export async function removeChat(req: Request, res: Response) {
  await deleteChat(req.user!.id, req.params.id);
  res.status(204).send();
}

export async function getMessages(req: Request, res: Response) {
  const msgs = await listMessages(req.user!.id, req.params.id);
  res.json(msgs);
}

const sendSchema = z.object({ content: z.string().trim().min(1) });
export const validateSend = validateBody(sendSchema);
export async function postSend(req: Request, res: Response) {
  const { content } = (req as any).validatedBody as z.infer<typeof sendSchema>;
  const result = await addUserAndAssistantMessage(req.user!.id, req.params.id, content);
  res.status(201).json(result);
}

const editSchema = z.object({
  messageId: z.string(),
  content: z.string().trim().min(1),
});
export const validateEdit = validateBody(editSchema);
export async function postEdit(req: Request, res: Response) {
  const { messageId, content } = (req as any).validatedBody as z.infer<typeof editSchema>;
  const result = await editAndResend(req.user!.id, req.params.id, messageId, content);
  res.status(201).json(result);
}

export async function removeMessage(req: Request, res: Response) {
  const { id, messageId } = req.params as { id: string; messageId: string };
  await deleteSingleMessage(req.user!.id, id, messageId);
  res.status(204).send();
}
