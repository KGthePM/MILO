import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import PodcastCard from './PodcastCard';

export default function PodcastTimeline({ podcasts, onEdit }) {
  const sorted = [...podcasts]
    .filter((p) => p.date_watched)
    .sort((a, b) => {
      const [yearA, monthA, dayA] = b.date_watched.split('-');
      const [yearB, monthB, dayB] = a.date_watched.split('-');
      return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
  const grouped = sorted.reduce((acc, p) => {
    const date = p.date_watched;
    if (!acc[date]) acc[date] = [];
    acc[date].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-neon-purple" size={24} />
        <h2 className="text-2xl font-bold neon-text-purple">Listening History Timeline</h2>
      </div>

      {Object.entries(grouped).map(([date, dayPodcasts], index) => (
        <motion.div
          key={date}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="relative pl-8 border-l-2 border-neon-purple/30"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.1 + 0.1 }}
            className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-neon-purple neon-border-purple pulse-glow"
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
            <p className="text-sm text-white/50">
              {dayPodcasts.length} podcast{dayPodcasts.length !== 1 ? 's' : ''} logged
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dayPodcasts.map((p) => (
              <PodcastCard key={p.id} podcast={p} onEdit={onEdit} />
            ))}
          </div>
        </motion.div>
      ))}

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-12 text-white/50">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No podcasts in your listening history yet.</p>
          <p className="text-sm">Start adding podcasts to see your timeline!</p>
        </div>
      )}
    </div>
  );
}
