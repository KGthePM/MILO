import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import SeriesCard from './SeriesCard';

export default function TVTimeline({ series, onEdit }) {
  const sortedSeries = [...series]
    .filter(s => s.date_watched)
    .sort((a, b) => {
      const [yearA, monthA, dayA] = b.date_watched.split('-');
      const [yearB, monthB, dayB] = a.date_watched.split('-');
      return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
  const groupedSeries = sortedSeries.reduce((acc, s) => {
    const date = s.date_watched;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-neon-magenta" size={24} />
        <h2 className="text-2xl font-bold neon-text-magenta">Watch History Timeline</h2>
      </div>

      {Object.entries(groupedSeries).map(([date, daySeries], index) => (
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
                  day: 'numeric'
                });
              })()}
            </h3>
            <p className="text-sm text-white/50">{daySeries.length} series watched</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {daySeries.map((s) => (
              <SeriesCard key={s.id} series={s} onEdit={onEdit} />
            ))}
          </div>
        </motion.div>
      ))}

      {Object.keys(groupedSeries).length === 0 && (
        <div className="text-center py-12 text-white/50">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No TV series in your watch history yet.</p>
          <p className="text-sm">Start adding series to see your timeline!</p>
        </div>
      )}
    </div>
  );
}
