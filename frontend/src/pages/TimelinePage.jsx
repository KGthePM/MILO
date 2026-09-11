import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Tv, Mic, LayoutGrid } from 'lucide-react';
import { useMovies } from '../utils/MovieContext';
import { useTVSeries } from '../utils/TVSeriesContext';
import { usePodcasts } from '../utils/PodcastContext';
import CombinedTimeline from '../components/timeline/CombinedTimeline';
import FloatingCommandBar from '../components/shared/FloatingCommandBar';
import { CONTENT_TYPES } from '../utils/contentTypes';

const FILTER_ICONS = { movie: Film, tv: Tv, podcast: Mic };

const FILTERS = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  ...Object.values(CONTENT_TYPES).map((ct) => ({
    id: ct.key,
    label: ct.nav,
    icon: FILTER_ICONS[ct.key],
  })),
];

const watchedOnly = (rows) => rows.filter((r) => (r.status || 'watched') === 'watched');

export default function TimelinePage() {
  const { movies } = useMovies();
  const { series } = useTVSeries();
  const { podcasts } = usePodcasts();
  const [filter, setFilter] = useState('all');

  const byType = {
    movie: watchedOnly(movies),
    tv: watchedOnly(series),
    podcast: watchedOnly(podcasts),
  };

  // 'all' shows every type; any other filter narrows to that one type.
  const shown = filter === 'all' ? byType : { [filter]: byType[filter] || [] };

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
      <div className="container mx-auto px-4 py-8 pb-40 sm:pb-32 max-w-7xl">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 flex items-center flex-wrap">
              <span className="neon-text-cyan">Time</span>
              <span className="neon-text-magenta">line</span>
              <span className="text-sm md:text-base text-white/40 font-light ml-4">
                Everything you've watched and heard, together
              </span>
            </h1>
            <p className="text-white/60">Your complete history on one timeline</p>
          </div>
        </motion.header>

        <motion.div className="mb-6 sm:mb-8 p-1 glass rounded-xl inline-flex">
          <div className="flex gap-2">
            {FILTERS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
                  filter === id
                    ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-magenta/20 text-white neon-border-magenta'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <CombinedTimeline itemsByType={shown} />
          </motion.div>
        </AnimatePresence>
      </div>

      <FloatingCommandBar page="timeline" />
    </div>
  );
}
