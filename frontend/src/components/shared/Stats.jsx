import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Film, Mic, Star, TrendingUp, Tv } from 'lucide-react';
import { getContentType, accentFor } from '../../utils/contentTypes';
import StatsSkeleton from './StatsSkeleton';

const CONFIG = {
  movie: { icon: Film, label: 'Movies' },
  tv: { icon: Tv, label: 'TV Series' },
  podcast: { icon: Mic, label: 'Podcasts' },
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

// Exported so the combined Dashboard page can build matching hero cards
// without re-inventing this markup.
export function StatCard({ accent, icon: Icon, label, value, decimals, caption, delay }) {
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
  const topGenre = analytics.topGenres && analytics.topGenres[0];

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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="glass rounded-xl p-5 neon-border-yellow"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon-yellow/40 bg-neon-yellow/20">
            <TrendingUp className="text-neon-yellow" size={18} />
          </div>
          <h3 className="text-sm font-medium text-white/80">Top Genre</h3>
        </div>
        <p className="truncate text-xl font-bold text-neon-yellow neon-text-yellow sm:text-2xl">
          {topGenre ? topGenre.genre : 'N/A'}
        </p>
        {topGenre?.count ? (
          <p className="mt-1 text-xs text-white/40">
            {topGenre.count} title{topGenre.count === 1 ? '' : 's'}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}
