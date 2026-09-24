import { accentFor } from '../../utils/contentTypes';
import { COVER_SIZE, coverShapeFor } from './CoverArt';

// Loading placeholder for the card grids. Replaces a spinning ring, which
// tells you the app is busy but nothing about what is coming; a skeleton in the
// real card's shape reads as "your library is arriving" and removes the layout
// jump when the data lands.
//
// Motion budget: ONE sweep per card, not one per bar. Commit bf98bb8 ("Fix iOS
// nav lag") is the cautionary tale — stacking infinite animations on every
// element starved the WKWebView main thread and ate nav taps. Six animated
// elements, on a view that exists for a few hundred milliseconds, is fine.
// .skeleton-sweep is disabled wholesale under prefers-reduced-motion.

function Bar({ w, h = 'h-3', className = '' }) {
  return <div className={`${w} ${h} rounded bg-white/[0.07] ${className}`} />;
}

function SkeletonCard({ ring, thumbSize, delay }) {
  return (
    <div className={`skeleton-sweep glass relative overflow-hidden rounded-xl border ${ring} p-4 sm:p-5`}
         style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <div className={`${thumbSize} flex-shrink-0 rounded-lg bg-white/[0.07]`} />
        <div className="min-w-0 flex-1">
          <Bar w="w-3/4" h="h-4" />
          <Bar w="w-1/2" className="mt-2.5" />
          <Bar w="w-2/5" className="mt-2" />
        </div>
      </div>
      {/* chips row */}
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-white/[0.07]" />
        <div className="h-6 w-20 rounded-full bg-white/[0.07]" />
      </div>
      <Bar w="w-full" className="mt-4" />
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.contentType  'movie' | 'tv' | 'podcast' — drives the accent
 * @param {number} [props.count]      cards to render
 */
export default function SkeletonGrid({ contentType = 'movie', count = 6 }) {
  const a = accentFor(contentType);
  // Every card leads with artwork: square for podcasts, a poster for movies/TV.
  const thumbSize = COVER_SIZE[coverShapeFor(contentType)];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} ring={a.ringSoft} thumbSize={thumbSize} delay={i * 90} />
      ))}
    </div>
  );
}
