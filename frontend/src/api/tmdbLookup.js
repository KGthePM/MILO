// Movie / TV metadata lookup via The Movie Database (TMDB) API.
//
// The counterpart to podcastLookup.js for the other two content types. TMDB
// sends permissive CORS headers and permits client-side keys, so it is called
// directly from the browser in local, cloud, and iOS builds — no proxy.
//
// Auth is a TMDB v4 "API Read Access Token" in VITE_TMDB_TOKEN. When it is
// unset, TMDB_ENABLED is false and the Find box simply isn't rendered, so a
// fresh checkout works with zero setup.
//
// TMDB's terms require attribution (see the Credits block in
// components/settings/DataSection.jsx) and cover non-commercial use only.
//
// Like the podcast lookup, every failure here is non-fatal by design: lookup is
// a convenience on top of the Add/Edit form and must never block manual entry.

const API_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TOKEN = import.meta.env.VITE_TMDB_TOKEN;

export const TMDB_ENABLED = Boolean(TOKEN);

// MILO's movie/TV genre list is fixed (the Add/Edit selects). TMDB names that
// don't appear here are mapped onto the nearest MILO genre, or dropped.
const MILO_GENRES = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror', 'Thriller', 'Romance', 'Animation', 'Documentary', 'Fantasy'];
const GENRE_ALIASES = {
  'Science Fiction': 'Sci-Fi',
  'Sci-Fi & Fantasy': 'Sci-Fi',
  'Action & Adventure': 'Action',
  Adventure: 'Action',
  Mystery: 'Thriller',
  Crime: 'Thriller',
};

// First TMDB genre that maps onto MILO's list, or '' so callers keep whatever
// the user already chose rather than injecting an unknown value.
function toMiloGenre(genres = []) {
  for (const { name } of genres) {
    const mapped = GENRE_ALIASES[name] || name;
    if (MILO_GENRES.includes(mapped)) return mapped;
  }
  return '';
}

const yearOf = (date) => (date && /^\d{4}/.test(date) ? date.slice(0, 4) : '');
const imageUrl = (path, size) => (path ? `${IMAGE_BASE}/${size}${path}` : '');

async function tmdbGet(path, params, signal) {
  const qs = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ''}`, {
    signal,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`TMDB lookup failed (${response.status})`);
  return response.json();
}

// Search-list shape. `thumb` is a small poster for the result row; `artwork_url`
// is the full-size poster saved on the record. `year` doubles as the fallback
// release_year if the follow-up details request fails.
function toResult(r, kind) {
  const title = kind === 'tv' ? r.name : r.title;
  const year = yearOf(kind === 'tv' ? r.first_air_date : r.release_date);
  return {
    tmdbId: r.id,
    title: title || '',
    year,
    thumb: imageUrl(r.poster_path, 'w92'),
    artwork_url: imageUrl(r.poster_path, 'w500'),
  };
}

async function search(kind, term, { signal, limit = 8 } = {}) {
  const q = (term || '').trim();
  if (!q || !TMDB_ENABLED) return [];
  const data = await tmdbGet(`/search/${kind}`, { query: q, include_adult: 'false' }, signal);
  return (data.results || [])
    .slice(0, limit)
    .map((r) => toResult(r, kind))
    .filter((r) => r.title);
}

/**
 * Search movies / TV series by title.
 * @returns {Promise<Array>} normalized results; [] when the term is blank
 * @throws only on network/HTTP failure, so callers can show a retry hint
 */
export const searchMovies = (term, options) => search('movie', term, options);
export const searchTV = (term, options) => search('tv', term, options);

/**
 * Full form fields for a picked movie. Never throws: if the details request
 * fails, it falls back to what the search result already carried.
 */
export async function getMovieDetails(result, { signal } = {}) {
  const fallback = { title: result.title, release_year: result.year, artwork_url: result.artwork_url };
  try {
    const d = await tmdbGet(`/movie/${result.tmdbId}`, { append_to_response: 'credits' }, signal);
    const directors = (d.credits?.crew || [])
      .filter((c) => c.job === 'Director')
      .map((c) => c.name);
    return {
      title: d.title || result.title,
      release_year: yearOf(d.release_date) || result.year,
      director: [...new Set(directors)].join(', '),
      genre: toMiloGenre(d.genres),
      artwork_url: imageUrl(d.poster_path, 'w500') || result.artwork_url,
    };
  } catch {
    return fallback;
  }
}

/** Full form fields for a picked TV series. Never throws; see getMovieDetails. */
export async function getTVDetails(result, { signal } = {}) {
  const fallback = { title: result.title, release_year: result.year, artwork_url: result.artwork_url };
  try {
    const d = await tmdbGet(`/tv/${result.tmdbId}`, {}, signal);
    return {
      title: d.name || result.title,
      release_year: yearOf(d.first_air_date) || result.year,
      num_seasons: typeof d.number_of_seasons === 'number' ? d.number_of_seasons : null,
      total_episodes: typeof d.number_of_episodes === 'number' ? d.number_of_episodes : null,
      genre: toMiloGenre(d.genres),
      artwork_url: imageUrl(d.poster_path, 'w500') || result.artwork_url,
    };
  } catch {
    return fallback;
  }
}
