import { Clock } from 'lucide-react';
import SeriesCard from './SeriesCard';
import TimelineGroupList, { dateValue, groupByDate } from '../timeline/TimelineGroupList';

export default function TVTimeline({ series, onEdit }) {
  const sortedSeries = [...series]
    .filter((s) => s.date_watched)
    .sort((a, b) => dateValue(b.date_watched) - dateValue(a.date_watched));

  const groups = groupByDate(sortedSeries);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-neon-magenta" size={24} />
        <h2 className="text-2xl font-bold neon-text-magenta">Watch History Timeline</h2>
      </div>

      <TimelineGroupList
        groups={groups}
        borderClass="border-l-2 border-neon-magenta/30"
        dotClass="bg-neon-magenta neon-border-magenta"
        countLabel={(daySeries) => `${daySeries.length} series watched`}
        emptyIcon={Clock}
        emptyTitle="No TV series in your watch history yet."
        emptyHint="Start adding series to see your timeline!"
        renderCard={(s) => <SeriesCard key={s.id} series={s} onEdit={onEdit} />}
      />
    </div>
  );
}
