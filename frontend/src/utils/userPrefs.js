import { DEFAULT_GENRE_COLORS } from './genreColors';

const STORAGE_KEY = 'milo.userPrefs.v1';

const DEFAULT_ONBOARDING = { introSeen: false, hints: {} };

const DEFAULTS = {
  genreColors: {},
  onboarding: DEFAULT_ONBOARDING,
};

const listeners = new Set();

export function loadUserPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    // Every nested object needs its own merge — a bare spread would let a
    // stored partial object replace the defaults wholesale.
    return {
      ...DEFAULTS,
      ...parsed,
      genreColors: { ...(parsed.genreColors || {}) },
      onboarding: {
        ...DEFAULT_ONBOARDING,
        ...(parsed.onboarding || {}),
        hints: { ...(parsed.onboarding?.hints || {}) },
      },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveUserPrefs(prefs) {
  // Storage can throw (private mode, quota). Listeners still fire so the
  // in-memory UI stays consistent for this session.
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
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

// --- Onboarding ------------------------------------------------------------
// The intro reel and discovery hints remember themselves per device. Each
// helper re-reads storage before writing so it never clobbers a change made
// elsewhere with a stale copy.

function updateOnboarding(fn) {
  const prefs = loadUserPrefs();
  saveUserPrefs({ ...prefs, onboarding: fn(prefs.onboarding) });
}

export function isIntroSeen() {
  return loadUserPrefs().onboarding.introSeen;
}

export function setIntroSeen(seen = true) {
  updateOnboarding((o) => ({ ...o, introSeen: seen }));
}

export function isHintSeen(id) {
  return !!loadUserPrefs().onboarding.hints[id];
}

export function markHintSeen(id) {
  updateOnboarding((o) => ({ ...o, hints: { ...o.hints, [id]: true } }));
}

export function resetHints() {
  updateOnboarding((o) => ({ ...o, hints: {} }));
}
