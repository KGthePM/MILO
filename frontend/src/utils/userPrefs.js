import { DEFAULT_GENRE_COLORS } from './genreColors';

const STORAGE_KEY = 'milo.userPrefs.v1';

const DEFAULTS = {
  genreColors: {},
};

const listeners = new Set();

export function loadUserPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      genreColors: { ...(parsed.genreColors || {}) },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveUserPrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  listeners.forEach((fn) => {
    try { fn(prefs); } catch {}
  });
}

export function subscribeUserPrefs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getEffectiveGenreColors() {
  const prefs = loadUserPrefs();
  return { ...DEFAULT_GENRE_COLORS, ...prefs.genreColors };
}
