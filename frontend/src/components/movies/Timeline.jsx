import { Clock } from 'lucide-react';
import MovieCard from './MovieCard';
import TimelineGroupList, { dateValue, groupByDate } from '../timeline/TimelineGroupList';

export default function Timeline({ movies }) {
  const sortedMovies = [...movies]
    .filter((movie) => movie.date_watched)
    .sort((a, b) => dateValue(b.date_watched) - dateValue(a.date_watched));

  const groups = groupByDate(sortedMovies);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-neon-cyan" size={24} />
        <h2 className="text-2xl font-bold neon-text-cyan">Watch History Timeline</h2>
      </div>

      <TimelineGroupList
        groups={groups}
        borderClass="border-l-2 border-neon-cyan/30"
        dotClass="bg-neon-cyan neon-border-cyan"
        countLabel={(dayMovies) =>
          `${dayMovies.length} movie${dayMovies.length !== 1 ? 's' : ''} watched`
        }
        emptyIcon={Clock}
        emptyTitle="No movies in your watch history yet."
        emptyAccent="cyan"
        emptyHint="Start adding movies to see your timeline!"
        renderCard={(movie) => <MovieCard key={movie.id} movie={movie} />}
      />
    </div>
  );
}
