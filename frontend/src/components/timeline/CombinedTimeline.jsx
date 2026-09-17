import { Clock, Film, Tv, Mic } from 'lucide-react';
import MovieCard from '../movies/MovieCard';
import SeriesCard from '../tv/SeriesCard';
import PodcastCard from '../podcasts/PodcastCard';
import { CONTENT_TYPES, ACCENT } from '../../utils/contentTypes';
import TimelineGroupList, { dateValue, groupByDate } from './TimelineGroupList';

// Per-type badge + card renderer. Keyed by content type so adding a fourth
// type is one entry here rather than another branch in the JSX below.
const RENDERERS = {
  movie: { icon: Film, badge: 'Movie', render: (item) => <MovieCard movie={item} /> },
  tv: { icon: Tv, badge: 'TV', render: (item) => <SeriesCard series={item} /> },
  podcast: { icon: Mic, badge: 'Podcast', render: (item) => <PodcastCard podcast={item} /> },
};

/**
 * @param {{ itemsByType: Record<string, Array> }} props
 *   Map of content-type key -> rows to show. Types omitted (or empty) are
 *   simply not rendered, which is how the page-level filter works.
 */
export default function CombinedTimeline({ itemsByType = {} }) {
  const items = Object.entries(itemsByType)
    .flatMap(([type, rows]) => (rows || []).map((r) => ({ ...r, _type: type })))
    .filter((item) => item.date_watched)
    .sort((a, b) => dateValue(b.date_watched) - dateValue(a.date_watched));

  const groups = groupByDate(items);

  const countLabel = (dayItems) => `${dayItems.length} logged`;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-neon-magenta" size={24} />
        <h2 className="text-2xl font-bold">
          <span className="neon-text-cyan">Watch </span>
          <span className="neon-text-magenta">History</span>
        </h2>
      </div>

      <TimelineGroupList
        groups={groups}
        borderClass="border-l-2 border-neon-magenta/30"
        dotClass="bg-neon-magenta neon-border-magenta"
        countLabel={countLabel}
        emptyIcon={Clock}
        emptyTitle="No watch history yet."
        emptyHint="Start adding titles to see your combined timeline!"
        renderCard={(item) => {
          const renderer = RENDERERS[item._type] || RENDERERS.movie;
          const Icon = renderer.icon;
          const a = ACCENT[(CONTENT_TYPES[item._type] || CONTENT_TYPES.movie).accent];
          return (
            <div key={`${item._type}-${item.id}`} className="relative">
              <div
                className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm border ${a.bgSoft} ${a.text} ${a.ringSoft}`}
              >
                <Icon size={11} />
                <span>{renderer.badge}</span>
              </div>
              {renderer.render(item)}
            </div>
          );
        }}
      />
    </div>
  );
}
