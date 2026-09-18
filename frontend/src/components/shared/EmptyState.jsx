import { motion } from 'framer-motion';
import { Plus, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { CONTENT_TYPES, ACCENT, getContentType, accentFor, iconFor } from '../../utils/contentTypes';

// The empty library is the screen right after sign-in for a brand-new user, so
// it gets treated as a real moment rather than a shrug.
//
// The important distinction the old inline blocks missed: "you have nothing
// yet" and "your filters matched nothing" are completely different situations
// wearing the same copy. The first wants an invitation to add something; the
// second wants a way back out of the filter. Showing "Add your first movie" to
// someone with 300 films who typed a bad search is just wrong. `variant`
// splits them.
//
// The backdrop grid is deliberately FLAT — a static repeating-gradient with a
// radial mask, no perspective, no 3D transform. It echoes the sign-in horizon
// without repeating the mistake that made that horizon smear on iOS; see the
// .auth-backdrop comment in index.css.

const COPY = {
  library: {
    movie: {
      title: 'Your reel is empty',
      body: 'Log the first film and MILO starts learning what you actually love.',
      action: 'Add a movie',
    },
    tv: {
      title: 'No series tracked yet',
      body: 'Add the first show and your timeline starts filling itself in.',
      action: 'Add a series',
    },
    podcast: {
      title: 'Nothing in the feed yet',
      body: 'Add the first show and MILO starts tuning what it suggests.',
      action: 'Add a podcast',
    },
  },
  watchlist: {
    movie: {
      title: 'Watchlist standing by',
      body: "Queue up something you've been meaning to get to.",
      action: 'Add to watchlist',
    },
    tv: {
      title: 'Watchlist standing by',
      body: "Queue up a series you've been meaning to start.",
      action: 'Add to watchlist',
    },
    podcast: {
      title: 'Listen list standing by',
      body: "Queue up a show you've been meaning to try.",
      action: 'Add to listen list',
    },
  },
};

// Dashed placeholders hinting at the shape of the cards that will land here.
// Purely decorative, and hidden from assistive tech.
function GhostCards({ ring }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-3 px-6 opacity-[0.18]">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`h-20 w-36 rounded-xl border border-dashed ${ring} ${i === 1 ? 'hidden sm:block' : ''} ${i === 2 ? 'hidden lg:block' : ''}`}
          style={{ transform: `translateY(${i === 1 ? 10 : 0}px)` }}
        />
      ))}
    </div>
  );
}

/**
 * @param {object}   props
 * @param {string}   props.contentType  'movie' | 'tv' | 'podcast'
 * @param {string}   props.variant      'library' | 'watchlist' | 'filtered'
 * @param {function} [props.onAction]   add handler (library/watchlist)
 * @param {function} [props.onClear]    clear-filters handler (filtered)
 * @param {string}   [props.accent]     override the accent ('cyan'|'magenta'|'purple')
 * @param {object}   [props.icon]       override the icon component
 * @param {string}   [props.title]      override the headline
 * @param {string}   [props.body]       override the sub-line
 * @param {string}   [props.actionLabel] override the button label
 * @param {boolean}  [props.showGhosts] override whether ghost cards render
 */
export default function EmptyState({
  contentType = 'movie',
  variant = 'library',
  onAction,
  onClear,
  accent,
  icon,
  title,
  body,
  actionLabel,
  showGhosts,
}) {
  const type = getContentType(contentType);
  const a = (accent && ACCENT[accent]) || accentFor(contentType);
  const Icon = icon || iconFor(contentType);
  const filtered = variant === 'filtered';

  const derived = filtered
    ? {
        title: `No ${CONTENT_TYPES[type.key].plural} match those filters`,
        body: 'Try a different genre, a wider date range, or clear the search.',
        action: 'Clear filters',
      }
    : (COPY[variant] || COPY.library)[type.key];

  // Explicit title/body win, so surfaces with their own voice (the timelines)
  // can reuse this shell without inheriting the library copy.
  const copy = {
    title: title || derived.title,
    body: body || derived.body,
    action: actionLabel || derived.action,
  };

  const ghosts = showGhosts === undefined ? !filtered : showGhosts;
  const handler = filtered ? onClear : onAction;
  const ActionIcon = filtered ? RotateCcw : Plus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-white/5 px-6 py-14 text-center"
    >
      {/* Flat accent grid, faded out toward the edges. */}
      <div aria-hidden="true" className="empty-grid absolute inset-0" />
      {ghosts && <GhostCards ring={a.ringSoft} />}

      <div className="relative z-10 flex flex-col items-center">
        <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${a.ringSoft} bg-black/40`}>
          {filtered ? (
            <SlidersHorizontal size={26} className={a.text} />
          ) : (
            <Icon size={26} className={a.text} />
          )}
        </div>

        <h3 className={`text-xl font-bold ${a.glow}`}>{copy.title}</h3>
        <p className="mt-2 max-w-sm text-sm text-white/50">{copy.body}</p>

        {handler && (
          <button
            onClick={handler}
            className={`mt-6 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-white transition-all ${a.btnPrimary}`}
          >
            <ActionIcon size={15} />
            {copy.action}
          </button>
        )}
      </div>
    </motion.div>
  );
}
