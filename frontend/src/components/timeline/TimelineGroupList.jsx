import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../shared/EmptyState';

// Progressive rendering for large timelines (iOS/WKWebView performance fix).
//
// Rendering every date group at once cost too much: hundreds of glass cards
// mounting in a single commit, entrance animations staggered `index * 0.1`
// (seconds of queued animation for big libraries), and an infinite
// pulse-glow box-shadow loop on every group dot kept the main thread busy
// indefinitely — navigation taps were dropped until it caught up.
//
// This component:
//   - mounts only the first INITIAL_GROUPS groups, then BATCH more when a
//     sentinel ~1200px below the fold scrolls into range (IntersectionObserver)
//   - caps the entrance stagger (MAX_STAGGER total)
//   - renders static dots (no infinite animation)
//   - marks each group `content-visibility: auto` with a size hint so the
//     browser also skips layout/paint for mounted-but-offscreen groups

const INITIAL_GROUPS = 8;
const BATCH = 6;
const ROOT_MARGIN = '1200px';
const MAX_STAGGER = 0.35;

export function dateValue(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function formatDateHeading(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Group pre-sorted items (already filtered to those with a date) by date,
 *  preserving order — returns [{ date, items }] in the given order. */
export function groupByDate(items) {
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date_watched) last.items.push(item);
    else groups.push({ date: item.date_watched, items: [item] });
  }
  return groups;
}

// Rough height estimate (header + single-column card stack, the mobile case)
// so content-visibility placeholders don't shift the scrollbar much.
function estimateHeight(count) {
  return Math.min(96 + count * 200, 1400);
}

export default function TimelineGroupList({
  groups,
  renderCard,
  countLabel,
  borderClass,
  dotClass,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyHint,
  emptyAccent = 'cyan',
}) {
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(INITIAL_GROUPS, groups.length)
  );
  const sentinelRef = useRef(null);
  const hasMore = visibleCount < groups.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + BATCH, groups.length));
        }
      },
      { rootMargin: ROOT_MARGIN }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, groups.length]);

  if (groups.length === 0) {
    return (
      <EmptyState
        accent={emptyAccent}
        icon={EmptyIcon}
        title={emptyTitle}
        body={emptyHint}
        showGhosts={false}
      />
    );
  }

  return (
    <>
      {groups.slice(0, visibleCount).map((group, index) => (
        <motion.div
          key={group.date}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.25,
            delay: Math.min(index * 0.05, MAX_STAGGER),
          }}
          className={`relative pl-8 ${borderClass}`}
          style={{
            contentVisibility: 'auto',
            containIntrinsicSize: `auto ${estimateHeight(group.items.length)}px`,
          }}
        >
          {/* Static marker dot — an animated glow here multiplied by every
              date group and ran forever; that repaint loop never idled. */}
          <div
            className={`absolute -left-2 top-0 w-4 h-4 rounded-full ${dotClass}`}
          />
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white/90 mb-1">
              {formatDateHeading(group.date)}
            </h3>
            <p className="text-sm text-white/50">{countLabel(group.items)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map(renderCard)}
          </div>
        </motion.div>
      ))}
      {hasMore && (
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      )}
    </>
  );
}
