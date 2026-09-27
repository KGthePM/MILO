// Parses the `[[Title|type|year]]` tags the assistant is prompted to wrap
// around each title it recommends (see buildAssistantPrompt). Tagged titles
// become addable picks in the chat; everything else stays plain prose, so a
// model that ignores the instruction (or an older stored reply) renders as it
// always did.

import { normalizeTitle } from './prompt';
import { isContentType } from '../utils/contentTypes';

const TAG_RE = /\[\[([^\[\]|]+?)\|([^\[\]|]*)(?:\|([^\[\]]*))?\]\]/g;

// Loose type names a model might write instead of the exact keys.
const TYPE_ALIASES = { film: 'movie', movies: 'movie', show: 'tv', series: 'tv', 'tv show': 'tv', podcasts: 'podcast', novel: 'book', books: 'book' };

function resolveType(raw) {
  const t = (raw || '').trim().toLowerCase();
  if (isContentType(t)) return t;
  return TYPE_ALIASES[t] || null;
}

/**
 * @param {string} text
 * @param {{ streaming?: boolean }} options  While streaming, an unclosed
 *   trailing `[[…` is held back so half-written brackets never flash.
 * @returns {{ segments: Array<{kind:'text', value:string} | {kind:'title', title:string, type:string, year:string, key:string}>, picks: Array<{title, type, year, key}> }}
 */
export function parseAssistantReply(text, { streaming = false } = {}) {
  let src = text || '';
  if (streaming) {
    const open = src.lastIndexOf('[[');
    if (open !== -1 && src.indexOf(']]', open) === -1) src = src.slice(0, open);
    else if (src.endsWith('[')) src = src.slice(0, -1);
  }

  const segments = [];
  const picks = [];
  const seen = new Set();
  let last = 0;
  for (const match of src.matchAll(TAG_RE)) {
    if (match.index > last) segments.push({ kind: 'text', value: src.slice(last, match.index) });
    last = match.index + match[0].length;

    const title = match[1].trim();
    const type = resolveType(match[2]);
    const year = (match[3] || '').replace(/[^\d]/g, '').slice(0, 4);
    // An unknown type can't be routed to a list — show the bare title.
    if (!type || !title) {
      segments.push({ kind: 'text', value: title });
      continue;
    }
    const pick = { title, type, year, key: `${type}:${normalizeTitle(title)}` };
    segments.push({ kind: 'title', ...pick });
    if (!seen.has(pick.key)) {
      seen.add(pick.key);
      picks.push(pick);
    }
  }
  if (last < src.length) segments.push({ kind: 'text', value: src.slice(last) });
  return { segments, picks };
}
