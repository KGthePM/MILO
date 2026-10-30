import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen, CalendarClock, ChevronDown, Clapperboard, Compass, Film, Flame, Gem,
  Headphones, Layers, Mic, PenLine, Pin, Sparkles, Star, ThumbsDown, TrendingUp, Tv,
} from 'lucide-react';
import { getContentType, accentFor } from '../../utils/contentTypes';
import { INSIGHT_ORDER, DEFAULT_HEADLINE, pickHeadline } from '../../utils/genreInsights';
import { getStatsHeadline, setStatsHeadline } from '../../utils/userPrefs';
import StatsSkeleton from './StatsSkeleton';

const CONFIG = {
  movie: { icon: Film, label: 'Movies' },
  tv: { icon: Tv, label: 'TV Series' },
  podcast: { icon: Mic, label: 'Podcasts' },
  book: { icon: BookOpen, label: 'Books' },
};

// Animates from the previous displayed value to `value` on change, easing
// out. Reduced-motion snaps straight to the target — framer-motion's
// useReducedMotion() is the only way to catch that here, since CSS
// prefers-reduced-motion (index.css) can't see framer-motion or rAF loops.
function useCountUp(value, { decimals = 0, duration = 700 } = {}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduceMotion) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return undefined;

    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduceMotion, duration]);

  return decimals > 0 ? display.toFixed(decimals) : Math.round(display);
}

const INSIGHT_ICONS = {
  signature: Sparkles,
  mostLogged: Layers,
  hiddenGem: Gem,
  onAKick: Flame,
  toughest: ThumbsDown,
  decade: CalendarClock,
  range: Compass,
};
const PERSON_ICONS = { movie: Clapperboard, podcast: Mic, book: PenLine };
const VOLUME_ICONS = { tv: Tv, podcast: Headphones, book: BookOpen };

function iconForInsight(id, contentType) {
  if (id === 'person') return PERSON_ICONS[contentType] || Star;
  if (id === 'volume') return VOLUME_ICONS[contentType] || Layers;
  return INSIGHT_ICONS[id] || TrendingUp;
}

function StatCard({ accent, icon: Icon, label, value, decimals, caption, delay }) {
  const display = useCountUp(value, { decimals });
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ delay, duration: 0.3 }}
      className={`glass rounded-xl p-5 ${accent.border}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${accent.ringSoft} ${accent.bgSoft}`}>
          <Icon className={accent.text} size={18} />
        </div>
        <h3 className="text-sm font-medium text-white/80">{label}</h3>
      </div>
      <p className={`text-3xl font-bold sm:text-4xl ${accent.glow}`}>{display}</p>
      {caption && <p className="mt-1 text-xs text-white/40">{caption}</p>}
    </motion.div>
  );
}

export default function Stats({ analytics, type = 'movie', loading = false }) {
  const contentType = getContentType(type).key;

  if (loading || !analytics) return <StatsSkeleton type={contentType} />;

  const { icon, label } = CONFIG[contentType];
  const accent = accentFor(contentType);

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        accent={accent}
        icon={icon}
        label={`Total ${label}`}
        value={analytics.total || 0}
        delay={0.1}
      />

      <StatCard
        accent={accent}
        icon={Star}
        label="Average Rating"
        value={analytics.avgRating || 0}
        decimals={1}
        caption="out of 10"
        delay={0.2}
      />

      <InsightTile analytics={analytics} contentType={contentType} />
    </div>
  );
}

// The third tile: a taste insight (Signature Genre by default) that opens a
// panel of the rest. Picking one pins it as the headline, per type, per
// device. Yellow is the accent precisely because this tile isn't a content
// type's — DESIGN.md §1 reserves it for that.
function InsightTile({ analytics, contentType }) {
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(() => getStatsHeadline(contentType));

  const insights = analytics.insights || {};
  const list = INSIGHT_ORDER.map((id) => insights[id]).filter(Boolean);
  // Older analytics payloads carry no insights; fall back to the raw count.
  const topGenre = analytics.topGenres && analytics.topGenres[0];
  const headline = pickHeadline(insights, pinned) || (topGenre
    ? { id: 'mostLogged', label: 'Top Genre', value: topGenre.genre, caption: `${topGenre.count} title${topGenre.count === 1 ? '' : 's'}` }
    : null);
  const expandable = list.length > 1;
  const HeadIcon = iconForInsight(headline?.id, contentType);
  const activeId = headline?.id;

  const pin = (id) => {
    // Tapping the current headline un-pins it back to the default.
    const next = id === activeId && pinned ? null : id === DEFAULT_HEADLINE ? null : id;
    setStatsHeadline(contentType, next);
    setPinned(next);
  };

  const Wrapper = expandable ? motion.button : motion.div;

  return (
    <>
      <Wrapper
        type={expandable ? 'button' : undefined}
        onClick={expandable ? () => setOpen((o) => !o) : undefined}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? panelId : undefined}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        whileTap={expandable && !reduceMotion ? { scale: 0.98 } : undefined}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="glass rounded-xl p-5 text-left neon-border-yellow"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-neon-yellow/40 bg-neon-yellow/20">
            <HeadIcon className="text-neon-yellow" size={18} />
          </div>
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">{headline?.label || 'Top Genre'}</h3>
          {expandable && (
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`flex-shrink-0 text-neon-yellow/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          )}
        </div>
        <p className="truncate text-xl font-bold text-neon-yellow neon-text-yellow sm:text-2xl">
          {headline ? headline.value : 'N/A'}
        </p>
        <p className="mt-1 truncate text-xs text-white/40">
          {headline ? headline.caption : 'Add genres to unlock taste insights'}
        </p>
        {expandable && <span className="sr-only">{open ? 'Hide' : 'Show'} more taste insights</span>}
      </Wrapper>

      <AnimatePresence initial={false}>
        {open && expandable && (
          <motion.div
            id={panelId}
            key="insights"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-neon-yellow/25 bg-bg-secondary/80 p-4 sm:col-span-3"
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h4 className="text-sm font-semibold text-white/90">Your taste, by the numbers</h4>
              <p className="text-xs text-white/40">Tap one to pin it to the tile</p>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
              {list.map((insight, i) => {
                const Icon = iconForInsight(insight.id, contentType);
                const active = insight.id === activeId;
                return (
                  <motion.button
                    key={insight.id}
                    type="button"
                    onClick={() => pin(insight.id)}
                    aria-pressed={active}
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.035, 0.3), duration: 0.2 }}
                    className={`relative rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? 'border-neon-yellow/60 bg-neon-yellow/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-neon-yellow/30 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <Icon size={14} className={active ? 'text-neon-yellow' : 'text-neon-yellow/60'} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-white/50">
                        {insight.label}
                      </span>
                      {active && <Pin size={12} className="flex-shrink-0 text-neon-yellow" aria-label="Pinned" />}
                    </div>
                    <p className={`truncate text-base font-bold ${active ? 'text-neon-yellow' : 'text-white'}`}>{insight.value}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-white/40">{insight.caption}</p>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
