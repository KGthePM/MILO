import { motion } from 'framer-motion';
import { Clock, Film, Tv } from 'lucide-react';
import MovieCard from '../movies/MovieCard';
import SeriesCard from '../tv/SeriesCard';

export default function CombinedTimeline({ movies = [], series = [] }) {
  const items = [
    ...movies.map((m) => ({ ...m, _type: 'movie' })),
    ...series.map((s) => ({ ...s, _type: 'tv' })),
  ]
    .filter((item) => item.date_watched)
    .sort((a, b) => {
      const [yearA, monthA, dayA] = b.date_watched.split('-');
      const [yearB, monthB, dayB] = a.date_watched.split('-');
      return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });

  const groupedItems = items.reduce((acc, item) => {
    const date = item.date_watched;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-neon-magenta" size={24} />
        <h2 className="text-2xl font-bold">
          <span className="neon-text-cyan">Watch </span>
          <span className="neon-text-magenta">History</span>
        </h2>
      </div>

      {Object.entries(groupedItems).map(([date, dayItems], index) => (
        <motion.div
          key={date}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="relative pl-8 border-l-2 border-neon-magenta/30"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.1 + 0.1 }}
            className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-neon-magenta neon-border-magenta pulse-glow"
          />
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white/90 mb-1">
              {(() => {
                const [year, month, day] = date.split('-');
                return new Date(year, month - 1, day).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });
              })()}
            </h3>
            <p className="text-sm text-white/50">
              {dayItems.length} watched
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dayItems.map((item) => (
              <div key={`${item._type}-${item.id}`} className="relative">
                <div
                  className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm ${
                    item._type === 'movie'
                      ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40'
                      : 'bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/40'
                  }`}
                >
                  {item._type === 'movie' ? <Film size={11} /> : <Tv size={11} />}
                  <span>{item._type === 'movie' ? 'Movie' : 'TV'}</span>
                </div>
                {item._type === 'movie' ? (
                  <MovieCard movie={item} />
                ) : (
                  <SeriesCard series={item} />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {Object.keys(groupedItems).length === 0 && (
        <div className="text-center py-12 text-white/50">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No watch history yet.</p>
          <p className="text-sm">Start adding movies and shows to see your combined timeline!</p>
        </div>
      )}
    </div>
  );
}
