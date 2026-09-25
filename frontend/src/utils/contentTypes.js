import { Film, Tv, Mic, BookOpen } from 'lucide-react';

// Single source of truth for MILO's content types.
//
// Before this existed, every type branch in the app was a binary ternary
// (`isMovies ? 'cyan' : 'magenta'`, `type === 'tv' ? ... : ...`), which silently
// mislabels any third type rather than failing. Add a type here and fix the
// places that consume CONTENT_TYPE_KEYS rather than introducing new ternaries.

export const CONTENT_TYPES = {
  movie: {
    key: 'movie',
    accent: 'cyan',
    nav: 'Movies',
    plural: 'movies',
    singular: 'movie',
    promptLabel: 'movies',
    path: '/movies',
    // Past-tense verb shown in the UI. The stored `status` value is always
    // 'watched' regardless — the AI layer filters on it.
    verb: 'Watched',
    verbTo: 'To Watch',
  },
  tv: {
    key: 'tv',
    accent: 'magenta',
    nav: 'TV',
    plural: 'TV series',
    singular: 'TV series',
    promptLabel: 'TV series',
    path: '/tv',
    verb: 'Watched',
    verbTo: 'To Watch',
  },
  podcast: {
    key: 'podcast',
    accent: 'purple',
    nav: 'Podcasts',
    plural: 'podcasts',
    singular: 'podcast',
    promptLabel: 'podcasts',
    path: '/podcasts',
    verb: 'Listened',
    verbTo: 'To Listen',
  },
  book: {
    key: 'book',
    accent: 'orange',
    nav: 'Books',
    plural: 'books',
    singular: 'book',
    promptLabel: 'books',
    path: '/books',
    verb: 'Read',
    verbTo: 'To Read',
  },
};

export const CONTENT_TYPE_KEYS = Object.keys(CONTENT_TYPES);

// Lucide icon per content type. Lives here rather than being re-declared at
// each call site so adding a type surfaces one gap instead of several silent
// fallbacks — the same reason the rest of this registry exists.
export const TYPE_ICONS = { movie: Film, tv: Tv, podcast: Mic, book: BookOpen };

export const iconFor = (contentType) => TYPE_ICONS[getContentType(contentType).key];

export const isContentType = (t) => Object.prototype.hasOwnProperty.call(CONTENT_TYPES, t);

export const getContentType = (t) => CONTENT_TYPES[t] || CONTENT_TYPES.movie;

// Tailwind's content extractor only sees complete literal class strings — it
// cannot resolve `text-${accent}`. Every class below must stay spelled out in
// full, or it will be purged from the production build.
export const ACCENT = {
  cyan: {
    text: 'text-neon-cyan',
    bgSoft: 'bg-neon-cyan/20',
    bgHover: 'hover:bg-neon-cyan/30',
    border: 'neon-border-cyan',
    glow: 'neon-text-cyan',
    ring: 'border-neon-cyan/60',
    ringSoft: 'border-neon-cyan/40',
    spinner: 'border-neon-cyan',
    grad: 'from-neon-cyan to-neon-purple',
    gradSoft: 'from-neon-cyan/20 to-neon-purple/20',
    gradVia: 'from-neon-cyan via-neon-purple to-neon-cyan',
    fade: 'from-transparent via-neon-cyan/50 to-transparent',
    hoverText: 'hover:text-neon-cyan',
    btnPrimary: 'bg-neon-cyan/20 border-neon-cyan/40 hover:bg-neon-cyan/30 hover:border-neon-cyan/70',
    btnSmall: 'bg-neon-cyan/15 border-neon-cyan/30 hover:bg-neon-cyan/25 hover:border-neon-cyan/60',
    chipActive: 'bg-neon-cyan/25 border-neon-cyan/60',
    fbActive: 'bg-neon-cyan/20 border-neon-cyan/40',
    barGrad: 'from-neon-cyan to-neon-purple',
    rowHover: 'hover:bg-neon-cyan/15',
    tileSoft: 'bg-neon-cyan/10',
    iconSoft: 'text-neon-cyan/70',
    edgeSoft: 'border-neon-cyan/30',
  },
  magenta: {
    text: 'text-neon-magenta',
    bgSoft: 'bg-neon-magenta/20',
    bgHover: 'hover:bg-neon-magenta/30',
    border: 'neon-border-magenta',
    glow: 'neon-text-magenta',
    ring: 'border-neon-magenta/60',
    ringSoft: 'border-neon-magenta/40',
    spinner: 'border-neon-magenta',
    grad: 'from-neon-magenta to-neon-purple',
    gradSoft: 'from-neon-magenta/20 to-neon-purple/20',
    gradVia: 'from-neon-magenta via-neon-purple to-neon-magenta',
    fade: 'from-transparent via-neon-magenta/50 to-transparent',
    hoverText: 'hover:text-neon-magenta',
    btnPrimary: 'bg-neon-magenta/20 border-neon-magenta/40 hover:bg-neon-magenta/30 hover:border-neon-magenta/70',
    btnSmall: 'bg-neon-magenta/15 border-neon-magenta/30 hover:bg-neon-magenta/25 hover:border-neon-magenta/60',
    chipActive: 'bg-neon-magenta/25 border-neon-magenta/60',
    fbActive: 'bg-neon-magenta/20 border-neon-magenta/40',
    barGrad: 'from-neon-magenta to-neon-purple',
    rowHover: 'hover:bg-neon-magenta/15',
    tileSoft: 'bg-neon-magenta/10',
    iconSoft: 'text-neon-magenta/70',
    edgeSoft: 'border-neon-magenta/30',
  },
  purple: {
    text: 'text-neon-purple',
    bgSoft: 'bg-neon-purple/20',
    bgHover: 'hover:bg-neon-purple/30',
    border: 'neon-border-purple',
    glow: 'neon-text-purple',
    ring: 'border-neon-purple/60',
    ringSoft: 'border-neon-purple/40',
    spinner: 'border-neon-purple',
    grad: 'from-neon-purple to-neon-cyan',
    gradSoft: 'from-neon-purple/20 to-neon-cyan/20',
    gradVia: 'from-neon-purple via-neon-cyan to-neon-purple',
    fade: 'from-transparent via-neon-purple/50 to-transparent',
    hoverText: 'hover:text-neon-purple',
    btnPrimary: 'bg-neon-purple/20 border-neon-purple/40 hover:bg-neon-purple/30 hover:border-neon-purple/70',
    btnSmall: 'bg-neon-purple/15 border-neon-purple/30 hover:bg-neon-purple/25 hover:border-neon-purple/60',
    chipActive: 'bg-neon-purple/25 border-neon-purple/60',
    fbActive: 'bg-neon-purple/20 border-neon-purple/40',
    barGrad: 'from-neon-purple to-neon-cyan',
    rowHover: 'hover:bg-neon-purple/15',
    tileSoft: 'bg-neon-purple/10',
    iconSoft: 'text-neon-purple/70',
    edgeSoft: 'border-neon-purple/30',
  },
  orange: {
    text: 'text-neon-orange',
    bgSoft: 'bg-neon-orange/20',
    bgHover: 'hover:bg-neon-orange/30',
    border: 'neon-border-orange',
    glow: 'neon-text-orange',
    ring: 'border-neon-orange/60',
    ringSoft: 'border-neon-orange/40',
    spinner: 'border-neon-orange',
    grad: 'from-neon-orange to-neon-magenta',
    gradSoft: 'from-neon-orange/20 to-neon-magenta/20',
    gradVia: 'from-neon-orange via-neon-magenta to-neon-orange',
    fade: 'from-transparent via-neon-orange/50 to-transparent',
    hoverText: 'hover:text-neon-orange',
    btnPrimary: 'bg-neon-orange/20 border-neon-orange/40 hover:bg-neon-orange/30 hover:border-neon-orange/70',
    btnSmall: 'bg-neon-orange/15 border-neon-orange/30 hover:bg-neon-orange/25 hover:border-neon-orange/60',
    chipActive: 'bg-neon-orange/25 border-neon-orange/60',
    fbActive: 'bg-neon-orange/20 border-neon-orange/40',
    barGrad: 'from-neon-orange to-neon-magenta',
    rowHover: 'hover:bg-neon-orange/15',
    tileSoft: 'bg-neon-orange/10',
    iconSoft: 'text-neon-orange/70',
    edgeSoft: 'border-neon-orange/30',
  },
};

export const accentFor = (contentType) => ACCENT[getContentType(contentType).accent];
