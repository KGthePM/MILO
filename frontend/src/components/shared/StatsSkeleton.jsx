import { accentFor } from '../../utils/contentTypes';

// Loading placeholder for the 3-card Stats row (Total / Average Rating / Top
// Genre). Same shape as the real cards so nothing jumps when analytics
// lands, and the same motion budget as SkeletonGrid/FriendRowsSkeleton: one
// sweep per card, disabled under prefers-reduced-motion via .skeleton-sweep.

function Card({ ring, delay }) {
  return (
    <div
      className={`skeleton-sweep glass relative overflow-hidden rounded-xl border ${ring} p-5`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-white/[0.07]" />
        <div className="h-3 w-24 rounded bg-white/[0.07]" />
      </div>
      <div className="h-8 w-16 rounded bg-white/[0.07] sm:h-9" />
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} [props.type]  'movie' | 'tv' | 'podcast' — drives the first card's accent
 */
export default function StatsSkeleton({ type = 'movie' }) {
  const a = accentFor(type);
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading stats…</span>
      <Card ring={a.ringSoft} delay={0} />
      <Card ring={a.ringSoft} delay={90} />
      <Card ring="border-neon-yellow/30" delay={180} />
    </div>
  );
}
