// Poster / cover-art lookup for AI recommendation cards.
//
// Reuses the Add-modal lookups (TMDB for movies/TV, iTunes for podcasts, Open
// Library for books) to find artwork for a title the model suggested. Doubles
// as a light grounding check:
// artwork is returned only when the found title actually matches the rec, since
// a wrong poster is worse than none. An unmatched rec is never hidden — it just
// keeps CoverArt's placeholder tile.
//
// Never throws. Results (misses included) are cached for the session, and
// in-flight lookups are shared, so Generate Again / Refresh — which often
// return the same titles — cost no extra requests. There is deliberately no
// abort signal: a shared promise must not be cancelled by one caller, and the
// requests are small; callers just ignore results they no longer need.

import { normalizeTitle } from '../ai/prompt';
import { TMDB_ENABLED, searchMovies, searchTV } from './tmdbLookup';
import { searchPodcasts } from './podcastLookup';
import { searchBooks } from './bookLookup';

const cache = new Map();

// Exact normalized match first; failing that, a result that is the rec title
// plus a subtitle (the model wrote "Mad Max", the catalog has "Mad Max: Fury Road").
function bestMatch(results, title) {
  const want = normalizeTitle(title);
  if (!want) return null;
  const exact = results.find((r) => normalizeTitle(r.title) === want);
  if (exact) return exact;
  const prefix = title.trim().toLowerCase();
  return results.find((r) => r.title.toLowerCase().startsWith(`${prefix}:`)) || null;
}

async function lookupScreen(kind, title, year) {
  const search = kind === 'tv' ? searchTV : searchMovies;
  let match = year ? bestMatch(await search(title, { limit: 5, year }), title) : null;
  if (!match) match = bestMatch(await search(title, { limit: 5 }), title);
  return match?.artwork_url ? { artwork_url: match.artwork_url, year: match.year || '' } : null;
}

async function lookupPodcast(title) {
  const match = bestMatch(await searchPodcasts(title, { limit: 5 }), title);
  return match?.artwork_url ? { artwork_url: match.artwork_url, year: '' } : null;
}

async function lookupBook(title) {
  const match = bestMatch(await searchBooks(title, { limit: 5 }), title);
  return match?.artwork_url
    ? { artwork_url: match.artwork_url, year: match.release_year ? String(match.release_year) : '' }
    : null;
}

/**
 * Artwork for one recommendation.
 * @returns {Promise<{ artwork_url: string, year: string } | null>}
 */
export function lookupRecArtwork(rec, contentType) {
  const title = (rec?.title || '').trim();
  if (!title) return Promise.resolve(null);
  if ((contentType === 'movie' || contentType === 'tv') && !TMDB_ENABLED) return Promise.resolve(null);

  const year = /^\d{4}$/.test(String(rec.year ?? '')) ? String(rec.year) : '';
  const key = `${contentType}:${normalizeTitle(title)}:${year}`;
  if (cache.has(key)) return cache.get(key);

  const pending = (contentType === 'podcast'
    ? lookupPodcast(title)
    : contentType === 'book'
    ? lookupBook(title)
    : lookupScreen(contentType === 'tv' ? 'tv' : 'movie', title, year)
  ).catch(() => {
    // A network/HTTP failure isn't a real miss — drop it so the next run retries.
    cache.delete(key);
    return null;
  });
  cache.set(key, pending);
  return pending;
}
