import { Request, Response } from 'express';
import { listCases, createCase, renameCase, deleteCase, addChatToCase, removeChatFromCase } from '../services/caseService.js';

export async function getCases(req: Request, res: Response) {
  const userId = (req as any).user.id as string;
  const cases = await listCases(userId);
  res.json(cases);
}

export async function postCase(req: Request, res: Response) {
  const userId = (req as any).user.id as string;
  const { name } = req.body as { name: string };
  const c = await createCase(userId, name || 'Нова папка');
  res.status(201).json(c);
}

export async function patchCase(req: Request, res: Response) {
  const userId = (req as any).user.id as string;
  const { id } = req.params as { id: string };
  const { name } = req.body as { name: string };
  await renameCase(userId, id, name);
  res.json({ ok: true });
}

export async function delCase(req: Request, res: Response) {
  const userId = (req as any).user.id as string;
  const { id } = req.params as { id: string };
  await deleteCase(userId, id);
  res.json({ ok: true });
}

export async function postCaseChat(req: Request, res: Response) {
  const userId = (req as any).user.id as string;
  const { id } = req.params as { id: string };
  const { chatId } = req.body as { chatId: string };
  await addChatToCase(userId, id, chatId);
  res.json({ ok: true });
}

export async function delCaseChat(req: Request, res: Response) {
  const userId = (req as any).user.id as string;
  const { id, chatId } = req.params as { id: string; chatId: string };
  await removeChatFromCase(userId, id, chatId);
  res.json({ ok: true });
}

