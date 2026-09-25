// Goodreads library import (Goodreads → My Books → Import and export →
// Export Library). Parsed entirely in the browser in both modes, like the
// Letterboxd import; the rows are then written through bookApi.importBooks.
//
// Export quirks handled here:
// - ISBNs are wrapped as Excel formulas: `="0441172717"`, and blank as `=""`.
// - "My Rating" is 0–5 whole stars, where 0 means unrated.
// - Titles carry the series suffix: "Leviathan Wakes (The Expanse, #1)".
// - "My Review" can hold HTML (<br/>, <i>…).
// - Genre isn't exported, but users' own shelves often name one ("sci-fi").

import { parseCSVText } from './letterboxdClient';
import { mapSubjectsToGenre, lookupByIsbns, lookupByTitles } from './bookLookup';
import { normalizeTitle } from '../ai/prompt';

const REQUIRED_HEADERS = ['Title', 'My Rating', 'Exclusive Shelf'];

// Exclusive shelves MILO understands. Currently-reading lands on the To Read
// list: MILO has no "reading" status, and it isn't finished (so has no rating).
const SHELF_STATUS = {
  read: 'watched',
  'to-read': 'to_watch',
  'currently-reading': 'to_watch',
};

const cleanIsbn = (v) => String(v || '').replace(/[^0-9Xx]/g, '').toUpperCase();

const stripSeries = (title) => title.replace(/\s*\([^()]*#\s*\d+(?:\.\d+)?\)\s*$/, '').trim();

function reviewToNotes(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Goodreads writes "2021/05/03"; MILO stores "2021-05-03".
function toIsoDate(v) {
  const m = String(v || '').trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

const toInt = (v) => {
  const n = parseInt(String(v || '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function parseGoodreadsCSV(file) {
  const text = await file.text();
  const rows = parseCSVText(text).filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
  if (rows.length === 0) throw new Error('That file is empty.');
  const headers = rows[0].map((h) => h.trim());
  if (!REQUIRED_HEADERS.every((h) => headers.includes(h))) {
    throw new Error("That doesn't look like a Goodreads export. In Goodreads, go to My Books → Import and export → Export Library.");
  }
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    return obj;
  });
}

/**
 * Map Goodreads rows onto MILO book rows.
 * @param {Array<object>} rows  output of parseGoodreadsCSV
 * @param {Array<object>} existingBooks  the user's current books, for de-duping
 */
export function processGoodreadsRows(rows, existingBooks = []) {
  const seen = new Set(existingBooks.map((b) => normalizeTitle(b.title)));
  const books = [];
  let unrated = 0;
  let otherShelf = 0;
  let duplicates = 0;

  for (const row of rows) {
    const rawTitle = String(row.Title || '').trim();
    if (!rawTitle) continue;

    const shelf = String(row['Exclusive Shelf'] || '').trim().toLowerCase();
    const status = SHELF_STATUS[shelf];
    if (!status) {
      otherShelf += 1;
      continue;
    }

    const stars = toInt(row['My Rating']);
    // MILO requires a rating on everything marked read.
    if (status === 'watched' && !stars) {
      unrated += 1;
      continue;
    }

    const title = stripSeries(rawTitle) || rawTitle;
    const key = normalizeTitle(title);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);

    const shelves = String(row.Bookshelves || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !SHELF_STATUS[s.toLowerCase()]);

    books.push({
      title,
      author: String(row.Author || '').trim() || null,
      rating: status === 'watched' ? Math.min(stars, 5) * 2 : null,
      status,
      date_watched: status === 'watched' ? toIsoDate(row['Date Read']) : null,
      release_year: toInt(row['Original Publication Year']) || toInt(row['Year Published']),
      page_count: toInt(row['Number of Pages']),
      genre: mapSubjectsToGenre(shelves) || '',
      notes: reviewToNotes(row['My Review']),
      artwork_url: null,
      // Not stored — used by enrichWithOpenLibrary, then dropped.
      _isbns: [cleanIsbn(row.ISBN13), cleanIsbn(row.ISBN)].filter(Boolean),
    });
  }

  return {
    totalInCSV: rows.length,
    toImport: books.length,
    read: books.filter((b) => b.status === 'watched').length,
    toRead: books.filter((b) => b.status === 'to_watch').length,
    unrated,
    otherShelf,
    duplicates,
    preview: books.slice(0, 5),
    allBooks: books,
  };
}

/**
 * Fill in covers (and genre/page count where the export had none) from Open
 * Library. Two batched passes: by ISBN first (exact edition), then by title +
 * author for whatever is still missing — Kindle editions export with no ISBN.
 * A book neither pass finds keeps the placeholder tile. Never throws.
 * @param {(done: number, total: number) => void} [onProgress]  counts queries
 */
export async function enrichWithOpenLibrary(books, onProgress) {
  const ISBN_BATCH = 40;
  const TITLE_BATCH = 10;
  const allIsbns = [...new Set(books.flatMap((b) => b._isbns))];
  const byIsbn = new Map();
  const byIndex = new Map();

  // Title-pass size isn't known until the ISBN pass ends, so the total is
  // estimated up front (every book might need it) and corrected after.
  const isbnQueries = Math.ceil(allIsbns.length / ISBN_BATCH);
  let total = isbnQueries + Math.ceil(books.length / TITLE_BATCH);
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  for (let i = 0; i < allIsbns.length; i += ISBN_BATCH) {
    try {
      const hits = await lookupByIsbns(allIsbns.slice(i, i + ISBN_BATCH));
      hits.forEach((v, k) => byIsbn.set(k, v));
    } catch {
      // One failed batch just means fewer covers — keep going.
    }
    tick();
  }

  const missing = books
    .map((b, idx) => ({ b, idx, hit: b._isbns.map((isbn) => byIsbn.get(isbn)).find((h) => h?.artwork_url) }))
    .filter(({ hit }) => !hit)
    .map(({ b, idx }) => ({ key: String(idx), title: b.title, author: b.author }));
  total = done + Math.ceil(missing.length / TITLE_BATCH);
  onProgress?.(done, total);

  for (let i = 0; i < missing.length; i += TITLE_BATCH) {
    try {
      const hits = await lookupByTitles(missing.slice(i, i + TITLE_BATCH));
      hits.forEach((v, k) => byIndex.set(Number(k), v));
    } catch {
      // Same as above.
    }
    tick();
  }

  return books.map(({ _isbns, ...book }, idx) => {
    const hit = _isbns.map((isbn) => byIsbn.get(isbn)).find((h) => h?.artwork_url)
      || byIndex.get(idx)
      || _isbns.map((isbn) => byIsbn.get(isbn)).find(Boolean);
    if (!hit) return book;
    return {
      ...book,
      artwork_url: hit.artwork_url || book.artwork_url,
      genre: book.genre || hit.genre || '',
      page_count: book.page_count || hit.page_count,
    };
  });
}
