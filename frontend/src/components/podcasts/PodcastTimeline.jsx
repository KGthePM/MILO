import { Clock } from 'lucide-react';
import PodcastCard from './PodcastCard';
import TimelineGroupList, { dateValue, groupByDate } from '../timeline/TimelineGroupList';

export default function PodcastTimeline({ podcasts, onEdit }) {
  const sorted = [...podcasts]
    .filter((p) => p.date_watched)
    .sort((a, b) => dateValue(b.date_watched) - dateValue(a.date_watched));

  const groups = groupByDate(sorted);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-neon-purple" size={24} />
        <h2 className="text-2xl font-bold neon-text-purple">Listening History Timeline</h2>
      </div>

      <TimelineGroupList
        groups={groups}
        borderClass="border-l-2 border-neon-purple/30"
        dotClass="bg-neon-purple neon-border-purple"
        countLabel={(dayPodcasts) =>
          `${dayPodcasts.length} podcast${dayPodcasts.length !== 1 ? 's' : ''} logged`
        }
        emptyIcon={Clock}
        emptyTitle="No podcasts in your listening history yet."
        emptyHint="Start adding podcasts to see your timeline!"
        renderCard={(p) => <PodcastCard key={p.id} podcast={p} onEdit={onEdit} />}
      />
    </div>
  );
}
