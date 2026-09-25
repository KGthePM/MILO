import { Clock } from 'lucide-react';
import BookCard from './BookCard';
import TimelineGroupList, { dateValue, groupByDate } from '../timeline/TimelineGroupList';

export default function BookTimeline({ books, onEdit }) {
  const sorted = [...books]
    .filter((p) => p.date_watched)
    .sort((a, b) => dateValue(b.date_watched) - dateValue(a.date_watched));

  const groups = groupByDate(sorted);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-neon-orange" size={24} />
        <h2 className="text-2xl font-bold neon-text-orange">Reading History Timeline</h2>
      </div>

      <TimelineGroupList
        groups={groups}
        borderClass="border-l-2 border-neon-orange/30"
        dotClass="bg-neon-orange neon-border-orange"
        countLabel={(dayBooks) =>
          `${dayBooks.length} book${dayBooks.length !== 1 ? 's' : ''} logged`
        }
        emptyIcon={Clock}
        emptyTitle="No books in your reading history yet."
        emptyAccent="orange"
        emptyHint="Start adding books to see your timeline!"
        renderCard={(p) => <BookCard key={p.id} book={p} onEdit={onEdit} />}
      />
    </div>
  );
}
