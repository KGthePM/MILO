// Screen genres (movies + TV). `Documentary` is shared with podcasts (same
// color in both maps), so it is intentionally not repeated below.
export const SCREEN_GENRE_COLORS = {
  Action: '#ff006e',
  Comedy: '#ffbe0b',
  Drama: '#8338ec',
  'Sci-Fi': '#00d4ff',
  Horror: '#ef4444',
  Thriller: '#f97316',
  Romance: '#ec4899',
  Animation: '#22c55e',
  Documentary: '#3b82f6',
  Fantasy: '#a855f7',
};

// Podcast genres, matching the `primaryGenreName` strings the iTunes Search
// API returns, so a looked-up show lands on a genre that already has a color.
export const PODCAST_GENRE_COLORS = {
  Comedy: '#ffbe0b',
  'True Crime': '#dc2626',
  Technology: '#06b6d4',
  News: '#64748b',
  'Society & Culture': '#f59e0b',
  History: '#b45309',
  Business: '#10b981',
  Science: '#0ea5e9',
  'Health & Fitness': '#84cc16',
  Sports: '#16a34a',
  Arts: '#d946ef',
  Music: '#a78bfa',
  Education: '#2563eb',
  Fiction: '#7c3aed',
  'TV & Film': '#fb7185',
  Leisure: '#f472b6',
};

export const DEFAULT_GENRE_COLORS = {
  ...SCREEN_GENRE_COLORS,
  ...PODCAST_GENRE_COLORS,
};

// Filter/select options are per content type — a podcast shouldn't offer
// "Sci-Fi" and a movie shouldn't offer "True Crime". Settings still exposes
// the full DEFAULT_GENRE_COLORS map for customization.
export const SCREEN_GENRE_LIST = Object.keys(SCREEN_GENRE_COLORS);
export const PODCAST_GENRE_LIST = Object.keys(PODCAST_GENRE_COLORS).sort();
export const GENRE_LIST = Object.keys(DEFAULT_GENRE_COLORS);

export function getGenreColor(genre, overrides = {}) {
  if (!genre) return null;
  return overrides[genre] || DEFAULT_GENRE_COLORS[genre] || null;
}

export function getGenreGlowStyle(genre, overrides = {}) {
  const color = getGenreColor(genre, overrides);
  if (!color) return { borderColor: 'rgba(255,255,255,0.2)' };
  return {
    borderColor: color,
    boxShadow: `0 0 12px ${color}66`,
  };
}
