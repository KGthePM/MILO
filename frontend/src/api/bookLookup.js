// Book metadata lookup via the Open Library Search API.
//
// Book half of MILO's external metadata lookup (movies/TV use TMDB, podcasts use
// iTunes). No API key, no auth, and it sends `Access-Control-Allow-Origin: *`,
// so it is called directly from the browser in both local and cloud mode — no
// proxy or backend route involved. Open Library is free and open data; it's
// credited in Settings next to TMDB.
//
// Every failure path here is non-fatal by design: lookup is a convenience on
// top of the Add form, and an outage must never block adding a book by hand.

import { BOOK_GENRE_LIST } from '../utils/genreColors';

const SEARCH_URL = 'https://openlibrary.org/search.json';
const FIELDS = 'key,title,author_name,first_publish_year,number_of_pages_median,cover_i,subject';

// Cover images by numeric cover ID are served without rate limits (lookups by
// ISBN/OLID are throttled per IP, so we never use those).
const coverUrl = (id, size = 'L') => (id ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : '');

// Open Library `subject` lists are free-form, long, and noisy: a classic can
// carry 100+ subjects, including tags inherited from its comic and film
// adaptations ("Comics & Graphic Novels" on The Great Gatsby). So rather than
// first-match-wins, each subject votes for the genres it matches, weighted by
// position (subjects run roughly most-to-least relevant). Adaptation tags don't
// vote, and the generic Fiction/Nonfiction buckets are down-weighted so they
// only win when nothing specific matched. Ties go to the earlier rule. No votes
// maps to '' so the caller leaves the user's genre alone rather than guessing.
const GENRE_RULES = [
  ['Graphic Novel', /\b(graphic[- ]novels?|comic books?|comics|manga)\b/],
  ['Sci-Fi', /\b(science[- ]fiction|sci-fi)\b/],
  ['Fantasy', /\bfantasy\b/],
  ['Horror', /\bhorror\b/],
  ['Mystery', /\b(mystery|detective|crime fiction)\b/],
  ['Thriller', /\b(thrillers?|suspense)\b/],
  ['Romance', /\b(romance|love stories)\b/],
  ['Historical Fiction', /\b(historical[- ]fiction|fiction, historical)\b/],
  ['Young Adult', /\b(young[- ]adult|juvenile fiction)\b/],
  ['Poetry', /\bpoetry\b/],
  ['Biography & Memoir', /\b(biography|autobiography|memoirs?)\b/],
  ['Self-Help', /\b(self-help|self-actualization|personal development)\b/],
  ['Business', /\b(business|economics|management|entrepreneurship)\b/],
  ['Philosophy', /\bphilosophy\b/],
  ['Essays', /\bessays\b/],
  ['Science', /^(science|physics|biology|chemistry|astronomy|mathematics|neuroscience|evolution)\b/],
  // Fiction subjects often end in ", history" ("Slavery, fiction, history"),
  // so History only counts subjects that never mention fiction.
  ['History', /^(?!.*fiction)(?:(history|world history)\b|.*\bhistory$)/],
  ['Literary Fiction', /\bliterary[- ]fiction\b|\bfiction, literary\b|^literary$/],
  ['Fiction', /\bfiction\b/],
  ['Nonfiction', /\bnon-?fiction\b/],
];
const GENERIC = new Set(['Fiction', 'Nonfiction']);
const SKIP_SUBJECT = /\badaptations?\b|\bmedia tie-in\b/;

export function mapSubjectsToGenre(subjects = []) {
  const scores = new Map();
  subjects.slice(0, 60).forEach((raw, i) => {
    const subject = String(raw).toLowerCase().trim();
    if (!subject || SKIP_SUBJECT.test(subject)) return;
    const weight = 1 / (1 + i / 8);
    for (const [genre, re] of GENRE_RULES) {
      if (re.test(subject)) {
        scores.set(genre, (scores.get(genre) || 0) + weight * (GENERIC.has(genre) ? 0.25 : 1));
      }
    }
  });
  let best = '';
  let bestScore = 0;
  for (const [genre] of GENRE_RULES) {
    const score = scores.get(genre) || 0;
    if (score > bestScore) {
      best = genre;
      bestScore = score;
    }
  }
  return BOOK_GENRE_LIST.includes(best) ? best : '';
}

function toBook(doc) {
  const authors = Array.isArray(doc.author_name) ? doc.author_name : [];
  return {
    olKey: doc.key,
    title: doc.title || '',
    author: authors.slice(0, 2).join(', '),
    // Unlike iTunes' releaseDate, first_publish_year is the book's actual debut.
    release_year: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
    page_count: typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : null,
    genre: mapSubjectsToGenre(doc.subject || []),
    artwork_url: coverUrl(doc.cover_i),
    thumb_url: coverUrl(doc.cover_i, 'S'),
  };
}

/**
 * Search books by title and/or author.
 * @param {string} term
 * @param {{ signal?: AbortSignal, limit?: number }} options
 * @returns {Promise<Array>} normalized results; [] when the term is blank
 * @throws only on network/HTTP failure, so callers can show a retry hint
 */
export async function searchBooks(term, { signal, limit = 10 } = {}) {
  const q = (term || '').trim();
  if (!q) return [];

  const params = new URLSearchParams({ q, fields: FIELDS, limit: String(limit) });
  const response = await fetch(`${SEARCH_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`Book lookup failed (${response.status})`);

  const data = await response.json();
  return (data.docs || []).map(toBook).filter((b) => b.title);
}

/**
 * Resolve many ISBNs in one request — used by the Goodreads import, where a
 * library can hold hundreds of books. Open Library throttles cover lookups by
 * ISBN, but a search on `isbn:(a OR b …)` is one ordinary query, and it returns
 * `cover_i`, whose cover URLs aren't throttled. Keep batches around 40 so the
 * URL stays short.
 * @param {string[]} isbns  digits only (ISBN-10 or -13)
 * @returns {Promise<Map<string, {artwork_url, genre, page_count}>>} keyed by
 *   every requested ISBN that matched
 * @throws on network/HTTP failure
 */
export async function lookupByIsbns(isbns, { signal } = {}) {
  const wanted = new Set(isbns);
  const found = new Map();
  if (wanted.size === 0) return found;

  const params = new URLSearchParams({
    q: `isbn:(${[...wanted].join(' OR ')})`,
    fields: 'isbn,cover_i,subject,number_of_pages_median',
    limit: String(wanted.size * 2),
  });
  const response = await fetch(`${SEARCH_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`Book lookup failed (${response.status})`);
  const data = await response.json();

  for (const doc of data.docs || []) {
    const info = {
      artwork_url: coverUrl(doc.cover_i),
      genre: mapSubjectsToGenre(doc.subject || []),
      page_count: typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : null,
    };
    for (const isbn of doc.isbn || []) {
      // Prefer a matching work that actually has a cover.
      if (wanted.has(isbn) && (!found.has(isbn) || (!found.get(isbn).artwork_url && info.artwork_url))) {
        found.set(isbn, info);
      }
    }
  }
  return found;
}

const normTitle = (t) => String(t || '').toLowerCase().replace(/^the\s+/, '').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
// Match on the main title: Goodreads keeps subtitles ("Sapiens: A Brief
// History of Humankind") that Open Library often files separately.
const mainTitle = (t) => String(t || '').split(':')[0].trim();

/**
 * Fallback for books with no ISBN (Kindle editions, mostly): one query covers
 * up to ~10 `(title:"…" AND author:"…")` clauses. A hit must match the main
 * title exactly; among matches the most-published work with a cover wins, which
 * skips box sets and translations.
 * @param {Array<{key: string, title: string, author?: string}>} items
 * @returns {Promise<Map<string, {artwork_url, genre, page_count}>>} keyed by item.key
 * @throws on network/HTTP failure
 */
export async function lookupByTitles(items, { signal } = {}) {
  const found = new Map();
  const usable = items.filter((i) => mainTitle(i.title));
  if (usable.length === 0) return found;

  const clause = (i) => {
    const title = mainTitle(i.title).replace(/"/g, '');
    const surname = String(i.author || '').split(',')[0].trim().split(/\s+/).pop()?.replace(/"/g, '');
    return surname ? `(title:"${title}" AND author:"${surname}")` : `(title:"${title}")`;
  };
  const params = new URLSearchParams({
    q: usable.map(clause).join(' OR '),
    fields: 'title,cover_i,subject,number_of_pages_median,edition_count',
    limit: String(usable.length * 6),
  });
  const response = await fetch(`${SEARCH_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`Book lookup failed (${response.status})`);
  const docs = (await response.json()).docs || [];

  for (const item of usable) {
    const want = normTitle(mainTitle(item.title));
    const best = docs
      .filter((d) => d.cover_i && normTitle(mainTitle(d.title)) === want)
      .sort((a, b) => (b.edition_count || 0) - (a.edition_count || 0))[0];
    if (best) {
      found.set(item.key, {
        artwork_url: coverUrl(best.cover_i),
        genre: mapSubjectsToGenre(best.subject || []),
        page_count: typeof best.number_of_pages_median === 'number' ? best.number_of_pages_median : null,
      });
    }
  }
  return found;
}
