import { Chat, Message } from '../models/index.js';
import type { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

type SourceOption = 'all' | 'bg' | 'en' | 'old';

export async function listChats(userId: string) {
const chats = (await Chat.find({ userId })
.sort({ createdAt: -1 })
.lean()
.exec()) as unknown as Array<{ _id: Types.ObjectId; title: string; createdAt: Date }>;
return chats.map((c) => ({
id: String(c._id as Types.ObjectId),
title: c.title,
createdAt: c.createdAt,
}));
}

export async function createChat(userId: string, title?: string) {
const chat = await Chat.create({ userId, title: title || 'Нов Чат' });
return { id: String(chat._id as Types.ObjectId), title: chat.title, createdAt: chat.createdAt };
}

export async function deleteChat(userId: string, chatId: string) {
const chat = await Chat.findOne({ _id: chatId, userId });
if (!chat) throw new ApiError(404, 'Chat not found');
await Message.deleteMany({ chatId: chat._id as Types.ObjectId });
await chat.deleteOne();
}

export async function listMessages(userId: string, chatId: string) {
const chat = await Chat.findOne({ _id: chatId, userId });
if (!chat) throw new ApiError(404, 'Chat not found');

const msgs = (await Message.find({ chatId: chat._id })
.sort({ createdAt: 1 })
.lean()
.exec()) as unknown as Array<{
_id: Types.ObjectId;
role: 'user' | 'assistant';
content: string;
createdAt: Date;
metadata?: any;
}>;
return msgs.map((m) => ({
id: String(m._id as Types.ObjectId),
role: m.role,
content: m.content,
createdAt: m.createdAt,
metadata: m.metadata || undefined,
}));
}

export async function addUserAndAssistantMessage(userId: string, chatId: string, content: string, options: SourceOption = 'all') {
const chat = await Chat.findOne({ _id: chatId, userId });
if (!chat) throw new ApiError(404, 'Chat not found');
const selectedOption: SourceOption = options || 'all';

// Check if this is the first message to set a title from it
const countBefore = await Message.countDocuments({ chatId: chat._id });
const userMsg = await Message.create({ chatId: chat._id, role: 'user', content, metadata: { options: selectedOption } });
if (countBefore === 0) {
const snippet = content.length > 50 ? content.slice(0, 50) + '…' : content;
await Chat.updateOne({ _id: chat._id }, { $set: { title: snippet } });
}

// Try to find a cached answer from a previous identical user question (exclude the message we just created)
const cachedUser = (await Message.findOne({
role: 'user',
content,
_id: { $ne: userMsg._id },
createdAt: { $lt: userMsg.createdAt },
...(selectedOption === 'all'
  ? { $or: [{ 'metadata.options': { $exists: false } }, { 'metadata.options': selectedOption }] }
  : { 'metadata.options': selectedOption }),
})
.sort({ createdAt: -1 })
.lean()
.exec()) as { _id: Types.ObjectId; chatId: Types.ObjectId; createdAt: Date } | null;

if (cachedUser) {
const cachedAssistant = (await Message.findOne({
chatId: cachedUser.chatId,
role: 'assistant',
createdAt: { $gte: cachedUser.createdAt },
})
.sort({ createdAt: 1 })
.lean()
.exec()) as { _id: Types.ObjectId; content: string; metadata?: any } | null;

if (cachedAssistant && cachedAssistant.content) {
  const cachedMetadata = cachedAssistant.metadata || {};
  const assistantMsg = await Message.create({
    chatId: chat._id,
    role: 'assistant',
    content: cachedAssistant.content,
    metadata: { ...cachedMetadata, options: (cachedMetadata as any).options ?? selectedOption },
  });
  return {
    userMessage: {
      id: String(userMsg._id as Types.ObjectId),
      content: userMsg.content,
      role: 'user' as const,
      createdAt: userMsg.createdAt,
      metadata: userMsg.metadata || undefined,
    },
    assistantMessage: {
      id: String(assistantMsg._id as Types.ObjectId),
      content: assistantMsg.content,
      role: 'assistant' as const,
      createdAt: assistantMsg.createdAt,
      metadata: assistantMsg.metadata || undefined,
    },
  };
}
}

// Call external generate API
let payload: any;
try {
const res = await fetch(env.GENERATE_URL, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ question: content, options: selectedOption }),
});
if (!res.ok) throw new Error(`Upstream error ${res.status}`);
payload = await res.json();
} catch (e) {
payload = { summary: 'Неуспешно извличане на отговор.', term: undefined, indices: [], sources: [], matches: [], results_count: 0 };
}

let summary: string = typeof payload.summary === 'string' ? payload.summary : '';
if (!summary || summary.trim().length === 0) {
summary = 'Няма наличен отговор.';
}
const metadata = {
term: payload.term,
indices: payload.indices ?? [],
sources: payload.sources ?? [],
matches: payload.matches ?? [],
results_count: payload.results_count ?? 0,
options: selectedOption,
};

const assistantMsg = await Message.create({ chatId: chat._id, role: 'assistant', content: summary, metadata });

return {
userMessage: {
id: String(userMsg._id as Types.ObjectId),
content: userMsg.content,
role: 'user' as const,
createdAt: userMsg.createdAt,
metadata: userMsg.metadata || undefined,
},
assistantMessage: {
id: String(assistantMsg._id as Types.ObjectId),
content: assistantMsg.content,
role: 'assistant' as const,
createdAt: assistantMsg.createdAt,
metadata,
},
};
}

export async function editAndResend(userId: string, chatId: string, userMessageId: string, content: string, options: SourceOption = 'all') {
const chat = await Chat.findOne({ _id: chatId, userId });
if (!chat) throw new ApiError(404, 'Chat not found');
const selectedOption: SourceOption = options || 'all';

const userMsg = await Message.findOne({ _id: userMessageId, chatId: chat._id, role: 'user' });
if (!userMsg) throw new ApiError(404, 'Message not found');

// Ensure it's the last user message in this chat to keep logic simple
const lastUser = await Message.findOne({ chatId: chat._id, role: 'user' }).sort({ createdAt: -1 });
if (!lastUser || String(lastUser._id as Types.ObjectId) !== String(userMsg._id as Types.ObjectId)) {
throw new ApiError(400, 'Only the latest user message can be edited');
}

const trimmed = (content ?? '').trim();
if (!trimmed) throw new ApiError(400, 'Content is required');

// Update the user message in-place with new content
userMsg.content = trimmed;
userMsg.metadata = { ...(userMsg.metadata || {}), options: selectedOption };
await userMsg.save();

// Remove the assistant message that follows (if any)
const nextAssistant = await Message.findOne({
chatId: chat._id,
role: 'assistant',
createdAt: { $gte: userMsg.createdAt },
}).sort({ createdAt: 1 });
if (nextAssistant) {
await Message.deleteOne({ _id: nextAssistant._id as Types.ObjectId });
}

// Try cache first: find any previous identical user message and its assistant reply
const cachedUser = (await Message.findOne({
role: 'user',
content: trimmed,
_id: { $ne: userMsg._id },
...(selectedOption === 'all'
  ? { $or: [{ 'metadata.options': { $exists: false } }, { 'metadata.options': selectedOption }] }
  : { 'metadata.options': selectedOption }),
})
.sort({ createdAt: -1 })
.lean()
.exec()) as { _id: Types.ObjectId; chatId: Types.ObjectId; createdAt: Date } | null;

if (cachedUser) {
const cachedAssistant = (await Message.findOne({
chatId: cachedUser.chatId,
role: 'assistant',
createdAt: { $gte: cachedUser.createdAt },
})
.sort({ createdAt: 1 })
.lean()
.exec()) as { _id: Types.ObjectId; content: string; metadata?: any } | null;

if (cachedAssistant && cachedAssistant.content) {
  const cachedMetadata = cachedAssistant.metadata || {};
  const assistantMsg = await Message.create({
    chatId: chat._id,
    role: 'assistant',
    content: cachedAssistant.content,
    metadata: { ...cachedMetadata, options: (cachedMetadata as any).options ?? selectedOption },
  });
  return {
    userMessage: {
      id: String(userMsg._id as Types.ObjectId),
      content: userMsg.content,
      role: 'user' as const,
      createdAt: userMsg.createdAt,
    },
    assistantMessage: {
      id: String(assistantMsg._id as Types.ObjectId),
      content: assistantMsg.content,
      role: 'assistant' as const,
      createdAt: assistantMsg.createdAt,
      metadata: assistantMsg.metadata || undefined,
    },
  };
}
}

// Generate a new assistant reply
let payload: any;
try {
const res = await fetch(env.GENERATE_URL, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ question: trimmed, options: selectedOption }),
});
if (!res.ok) throw new Error(`Upstream error ${res.status}`);
payload = await res.json();
} catch (e) {
payload = { summary: 'Неуспешно извличане на отговор.', term: undefined, indices: [], sources: [], matches: [], results_count: 0 };
}

let summary: string = typeof payload.summary === 'string' ? payload.summary : '';
if (!summary || summary.trim().length === 0) {
summary = 'Няма наличен отговор.';
}
const metadata = {
term: payload.term,
indices: payload.indices ?? [],
sources: payload.sources ?? [],
matches: payload.matches ?? [],
results_count: payload.results_count ?? 0,
options: selectedOption,
};

const assistantMsg = await Message.create({ chatId: chat._id, role: 'assistant', content: summary, metadata });

return {
userMessage: {
id: String(userMsg._id as Types.ObjectId),
content: userMsg.content,
role: 'user' as const,
createdAt: userMsg.createdAt,
metadata: userMsg.metadata || undefined,
},
assistantMessage: {
id: String(assistantMsg._id as Types.ObjectId),
content: assistantMsg.content,
role: 'assistant' as const,
createdAt: assistantMsg.createdAt,
metadata,
},
};
}

export async function deleteSingleMessage(userId: string, chatId: string, messageId: string) {
const chat = await Chat.findOne({ _id: chatId, userId });
if (!chat) throw new ApiError(404, 'Chat not found');

const msg = await Message.findOne({ _id: messageId, chatId: chat._id });
if (!msg) throw new ApiError(404, 'Message not found');

// Delete the message itself
await Message.deleteOne({ _id: msg._id as Types.ObjectId });

// If it's a user message, also delete the next assistant reply in this chat (if any)
if (msg.role === 'user') {
const nextAssistant = await Message.findOne({
chatId: chat._id,
role: 'assistant',
createdAt: { $gte: msg.createdAt },
}).sort({ createdAt: 1 });
if (nextAssistant) {
await Message.deleteOne({ _id: nextAssistant._id as Types.ObjectId });
}
} else if (msg.role === 'assistant') {
// If deleting an assistant, also delete the nearest previous user message in this chat (pair)
const prevUser = await Message.findOne({
chatId: chat._id,
role: 'user',
createdAt: { $lte: msg.createdAt },
}).sort({ createdAt: -1 });
if (prevUser) {
await Message.deleteOne({ _id: prevUser._id as Types.ObjectId });
}
}

const left = await Message.countDocuments({ chatId: chat._id });
if (left === 0) {
await chat.deleteOne();
}
}
