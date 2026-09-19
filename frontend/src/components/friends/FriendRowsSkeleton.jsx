// Loading placeholder for the friends list and the request lists.
//
// These lists are rows, not cards, so SkeletonGrid's shape is wrong here — the
// point of a skeleton is that the real content lands into the same silhouette
// with no jump. Same motion budget as SkeletonGrid: ONE sweep per row (see the
// .skeleton-sweep comment in index.css), disabled under prefers-reduced-motion.

/**
 * @param {object} props
 * @param {number} [props.count]  rows to render
 * @param {string} [props.ring]   complete literal border class for the row edge
 */
export default function FriendRowsSkeleton({ count = 3, ring = 'border-neon-cyan/20' }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`skeleton-sweep glass relative overflow-hidden rounded-xl border ${ring} p-4`}
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-white/[0.07]" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-2/5 rounded bg-white/[0.07]" />
              <div className="mt-2 h-3 w-1/4 rounded bg-white/[0.07]" />
            </div>
            <div className="h-5 w-5 flex-shrink-0 rounded bg-white/[0.07]" />
          </div>
        </div>
      ))}
    </div>
  );
}
