// Titles the assistant has tagged as picks in recent chats, kept per device so
// "New conversation" doesn't hand back the same list. Fed into the prompt as a
// don't-repeat block (see buildAssistantPrompt). Deliberately NOT cleared with
// the conversation — a fresh chat should mean fresh picks.

const STORAGE_KEY = 'milo.assistantSuggested.v1';
const MAX_ENTRIES = 60;
const MAX_AGE_MS = 30 * 86400000;

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((e) => e && e.key && e.title) : [];
  } catch {
    return [];
  }
}

// Most recent first, expired entries dropped.
export function loadRecentlySuggested(now = Date.now()) {
  return read().filter((e) => now - (e.ts || 0) < MAX_AGE_MS);
}

// `picks` are parseAssistantReply picks: { key, title, type, year }.
export function rememberSuggested(picks, now = Date.now()) {
  if (!Array.isArray(picks) || !picks.length) return;
  const fresh = picks.map(({ key, title, type }) => ({ key, title, type, ts: now }));
  const keys = new Set(fresh.map((e) => e.key));
  const merged = [...fresh, ...loadRecentlySuggested(now).filter((e) => !keys.has(e.key))].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore quota errors
  }
}
