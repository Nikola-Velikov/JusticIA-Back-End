import { Chat, Message } from '../models/index.js';
import type { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

type SourceOption = 'all' | 'bg' | 'en' | 'old';

const ELLIPSIS = '...';
const MAX_ASSISTANT_CONTENT_BYTES = 128 * 1024;
const MAX_METADATA_BYTES = 512 * 1024;
const MAX_TERM_BYTES = 512;
const MAX_INDEX_BYTES = 512;
const MAX_SOURCE_TITLE_BYTES = 512;
const MAX_SOURCE_INDEX_BYTES = 1024;
const MAX_MATCH_BYTES = 4096;
const MAX_MATCHES_BYTES = 256 * 1024;
const MAX_INDICES = 25;
const MAX_SOURCES = 25;
const MAX_MATCHES = 80;

type AssistantMetadata = {
term?: string;
indices?: string[];
sources?: Array<{ index: string; title: string }>;
matches?: string[];
results_count?: number;
options: SourceOption;
truncated?: boolean;
};

function byteLength(value: string) {
return Buffer.byteLength(value, 'utf8');
}

function truncateUtf8(value: unknown, maxBytes: number) {
if (typeof value !== 'string') return '';
if (maxBytes <= byteLength(ELLIPSIS)) return ELLIPSIS.slice(0, Math.max(0, maxBytes));
if (byteLength(value) <= maxBytes) return value;

let out = '';
for (const char of value) {
  if (byteLength(out) + byteLength(char) + byteLength(ELLIPSIS) > maxBytes) break;
  out += char;
}

return `${out}${ELLIPSIS}`;
}

function sanitizeStringArray(
value: unknown,
maxItems: number,
maxItemBytes: number,
totalBytes?: number
) {
if (!Array.isArray(value)) return { value: [] as string[], truncated: false };

const out: string[] = [];
let truncated = false;
let total = 0;

for (const entry of value) {
  if (typeof entry !== 'string') {
    truncated = true;
    continue;
  }
  if (out.length >= maxItems) {
    truncated = true;
    break;
  }

  const next = truncateUtf8(entry, maxItemBytes);
  if (next !== entry) truncated = true;

  const nextBytes = byteLength(next);
  if (typeof totalBytes === 'number' && total + nextBytes > totalBytes) {
    truncated = true;
    break;
  }

  out.push(next);
  total += nextBytes;
}

return { value: out, truncated };
}

function sanitizeSources(value: unknown) {
if (!Array.isArray(value)) {
  return { value: [] as Array<{ index: string; title: string }>, truncated: false };
}

const out: Array<{ index: string; title: string }> = [];
let truncated = false;

for (const entry of value) {
  if (!entry || typeof entry !== 'object') {
    truncated = true;
    continue;
  }
  if (out.length >= MAX_SOURCES) {
    truncated = true;
    break;
  }

  const record = entry as Record<string, unknown>;
  const title = truncateUtf8(record.title ?? '', MAX_SOURCE_TITLE_BYTES).trim();
  const index = truncateUtf8(record.index ?? '', MAX_SOURCE_INDEX_BYTES).trim();

  if ((record.title ?? '') !== title || (record.index ?? '') !== index) truncated = true;
  if (!title && !index) {
    truncated = true;
    continue;
  }

  out.push({ title: title || 'Untitled source', index });
}

return { value: out, truncated };
}

function sanitizeResultsCount(value: unknown) {
if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
return Math.max(0, Math.trunc(value));
}

function buildAssistantMetadata(payload: any, selectedOption: SourceOption): AssistantMetadata {
const safeTerm = truncateUtf8(payload?.term ?? '', MAX_TERM_BYTES).trim();
const safeIndices = sanitizeStringArray(payload?.indices, MAX_INDICES, MAX_INDEX_BYTES);
const safeSources = sanitizeSources(payload?.sources);
const safeMatches = sanitizeStringArray(payload?.matches, MAX_MATCHES, MAX_MATCH_BYTES, MAX_MATCHES_BYTES);

const metadata: AssistantMetadata = {
  term: safeTerm || undefined,
  indices: safeIndices.value,
  sources: safeSources.value,
  matches: safeMatches.value,
  results_count: sanitizeResultsCount(payload?.results_count),
  options: selectedOption,
};

let truncated = safeTerm !== (typeof payload?.term === 'string' ? payload.term : '')
  || safeIndices.truncated
  || safeSources.truncated
  || safeMatches.truncated;

while (byteLength(JSON.stringify(metadata)) > MAX_METADATA_BYTES && metadata.matches && metadata.matches.length > 0) {
  metadata.matches.pop();
  truncated = true;
}
while (byteLength(JSON.stringify(metadata)) > MAX_METADATA_BYTES && metadata.sources && metadata.sources.length > 0) {
  metadata.sources.pop();
  truncated = true;
}
while (byteLength(JSON.stringify(metadata)) > MAX_METADATA_BYTES && metadata.indices && metadata.indices.length > 0) {
  metadata.indices.pop();
  truncated = true;
}
if (byteLength(JSON.stringify(metadata)) > MAX_METADATA_BYTES && metadata.term) {
  metadata.term = truncateUtf8(metadata.term, 128);
  truncated = true;
}

if (truncated) metadata.truncated = true;
return metadata;
}

function sanitizeAssistantContent(value: unknown) {
const summary = typeof value === 'string' ? value : '';
const safeSummary = truncateUtf8(summary, MAX_ASSISTANT_CONTENT_BYTES).trim();
return safeSummary || 'РќСЏРјР° РЅР°Р»РёС‡РµРЅ РѕС‚РіРѕРІРѕСЂ.';
}

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
metadata: m.role === 'assistant'
  ? buildAssistantMetadata(m.metadata || {}, ((m.metadata as any)?.options as SourceOption) || 'all')
  : (m.metadata || undefined),
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
  const assistantContent = sanitizeAssistantContent(cachedAssistant.content);
  const assistantMetadata = buildAssistantMetadata(
    { ...cachedMetadata, options: (cachedMetadata as any).options ?? selectedOption },
    selectedOption
  );
  const assistantMsg = await Message.create({
    chatId: chat._id,
    role: 'assistant',
    content: assistantContent,
    metadata: assistantMetadata,
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
const assistantContent = sanitizeAssistantContent(summary);
const assistantMetadata = buildAssistantMetadata(payload, selectedOption);

const assistantMsg = await Message.create({ chatId: chat._id, role: 'assistant', content: assistantContent, metadata: assistantMetadata });

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
metadata: assistantMetadata,
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
  const assistantContent = sanitizeAssistantContent(cachedAssistant.content);
  const assistantMetadata = buildAssistantMetadata(
    { ...cachedMetadata, options: (cachedMetadata as any).options ?? selectedOption },
    selectedOption
  );
  const assistantMsg = await Message.create({
    chatId: chat._id,
    role: 'assistant',
    content: assistantContent,
    metadata: assistantMetadata,
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
const assistantContent = sanitizeAssistantContent(summary);
const assistantMetadata = buildAssistantMetadata(payload, selectedOption);

const assistantMsg = await Message.create({ chatId: chat._id, role: 'assistant', content: assistantContent, metadata: assistantMetadata });

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
metadata: assistantMetadata,
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