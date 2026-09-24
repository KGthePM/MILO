// Podcast metadata lookup via the iTunes Search API.
//
// Podcast half of MILO's external metadata lookup (movies/TV use TMDB, see
// tmdbLookup.js). No API key, no auth, and it sends
// `Access-Control-Allow-Origin: *`, so it is called directly from the browser
// in both local and cloud mode — no proxy or backend route involved.
//
// Every failure path here is non-fatal by design: lookup is a convenience on
// top of the Add form, and an outage must never block adding a podcast by hand.

const SEARCH_URL = 'https://itunes.apple.com/search';

// iTunes' `releaseDate` is the date of the show's MOST RECENT episode, not its
// debut, so it is deliberately not mapped to release_year — it would write a
// misleading year for any active show.
function toPodcast(result) {
  return {
    itunesId: result.collectionId,
    title: result.collectionName || result.trackName || '',
    host: result.artistName || '',
    publisher: result.artistName || '',
    genre: result.primaryGenreName || '',
    artwork_url: result.artworkUrl600 || result.artworkUrl100 || '',
    total_episodes: typeof result.trackCount === 'number' ? result.trackCount : null,
    feedUrl: result.feedUrl || '',
  };
}

/**
 * Search podcasts by name.
 * @param {string} term
 * @param {{ signal?: AbortSignal, limit?: number }} options
 * @returns {Promise<Array>} normalized results; [] when the term is blank
 * @throws only on network/HTTP failure, so callers can show a retry hint
 */
export async function searchPodcasts(term, { signal, limit = 10 } = {}) {
  const q = (term || '').trim();
  if (!q) return [];

  const params = new URLSearchParams({
    media: 'podcast',
    entity: 'podcast',
    term: q,
    limit: String(limit),
  });

  const response = await fetch(`${SEARCH_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`Podcast lookup failed (${response.status})`);

  // The iTunes endpoint occasionally returns JS-ish content types, so parse the
  // body as text rather than trusting response.json().
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Podcast lookup returned an unreadable response');
  }

  return (data.results || []).map(toPodcast).filter((p) => p.title);
}
