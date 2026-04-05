import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function tryParseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    const message = (payload as { message?: unknown }).message;
    if (typeof error === 'string' && error.trim()) return error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export async function runLegalSearch(payload: unknown) {
  let response: Response;

  try {
    response = await fetch(env.SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError(502, 'Search service is unavailable');
  }

  const raw = await response.text();
  const parsed = tryParseJson(raw);

  if (!response.ok) {
    const message = extractErrorMessage(parsed, response.statusText || 'Search failed');
    throw new ApiError(response.status >= 500 ? 502 : response.status, message, parsed ?? raw);
  }

  return parsed ?? {};
}
