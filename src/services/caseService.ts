import { CaseModel, Chat } from '../models/index.js';
import type { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

export async function listCases(userId: string) {
  const cases = await CaseModel.find({ userId }).sort({ createdAt: -1 }).lean().exec();
  return cases.map(c => ({
    id: String(c._id as Types.ObjectId),
    name: c.name,
    chatIds: (c.chatIds || []).map(id => String(id as Types.ObjectId)),
    createdAt: c.createdAt,
  }));
}

export async function createCase(userId: string, name: string) {
  const c = await CaseModel.create({ userId, name, chatIds: [] });
  return { id: String(c._id as Types.ObjectId), name: c.name, chatIds: [], createdAt: c.createdAt };
}

export async function renameCase(userId: string, caseId: string, name: string) {
  const c = await CaseModel.findOne({ _id: caseId, userId });
  if (!c) throw new ApiError(404, 'Case not found');
  c.name = name;
  await c.save();
}

export async function deleteCase(userId: string, caseId: string) {
  const c = await CaseModel.findOne({ _id: caseId, userId });
  if (!c) throw new ApiError(404, 'Case not found');
  await c.deleteOne();
}

export async function addChatToCase(userId: string, caseId: string, chatId: string) {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw new ApiError(404, 'Chat not found');
  // Ensure unique membership: remove from all cases first
  await CaseModel.updateMany({ userId, chatIds: chat._id }, { $pull: { chatIds: chat._id } });
  // Add to target
  await CaseModel.updateOne({ _id: caseId, userId }, { $addToSet: { chatIds: chat._id } });
}

export async function removeChatFromCase(userId: string, caseId: string, chatId: string) {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw new ApiError(404, 'Chat not found');
  await CaseModel.updateOne({ _id: caseId, userId }, { $pull: { chatIds: chat._id } });
}

