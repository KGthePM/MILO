import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers, Star, TrendingUp } from 'lucide-react';
import { useMovies } from '../utils/MovieContext';
import { useTVSeries } from '../utils/TVSeriesContext';
import { usePodcasts } from '../utils/PodcastContext';
import { CONTENT_TYPES, accentFor, iconFor } from '../utils/contentTypes';
import { StatCard } from '../components/shared/Stats';
import StatsSkeleton from '../components/shared/StatsSkeleton';
import FloatingCommandBar from '../components/shared/FloatingCommandBar';
import EmptyState from '../components/shared/EmptyState';

// Sums each type's topGenres by name so a genre popular across, say, movies
// and podcasts still wins over one type's single biggest genre.
function mergeTopGenre(analyticsList) {
  const counts = new Map();
  analyticsList.forEach((a) => {
    (a?.topGenres || []).forEach(({ genre, count }) => {
      if (!genre) return;
      counts.set(genre, (counts.get(genre) || 0) + (count || 0));
    });
  });
  let top = null;
  counts.forEach((count, genre) => {
    if (!top || count > top.count) top = { genre, count };
  });
  return top;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { analytics: movieAnalytics, loading: moviesLoading } = useMovies();
  const { analytics: tvAnalytics, loading: tvLoading } = useTVSeries();
  const { analytics: podAnalytics, loading: podLoading } = usePodcasts();

  const loading = moviesLoading || tvLoading || podLoading;
  const byType = { movie: movieAnalytics, tv: tvAnalytics, podcast: podAnalytics };

  const { grandTotal, avgRating, topGenre } = useMemo(() => {
    const list = [movieAnalytics, tvAnalytics, podAnalytics];
    const total = list.reduce((sum, a) => sum + (a?.total || 0), 0);
    const weightedSum = list.reduce((sum, a) => sum + (a?.avgRating || 0) * (a?.total || 0), 0);
    return {
      grandTotal: total,
      avgRating: total > 0 ? weightedSum / total : 0,
      topGenre: mergeTopGenre(list),
    };
  }, [movieAnalytics, tvAnalytics, podAnalytics]);

  const primary = accentFor('movie');

  return (
    <div className="min-h-screen safe-area bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
      <div className="container mx-auto max-w-7xl px-4 py-8 pb-40 sm:pb-32">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="mb-2 flex flex-wrap items-center gap-4 text-3xl font-bold sm:text-4xl md:text-5xl">
            <span className="bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-purple bg-clip-text text-transparent">
              Dashboard
            </span>
            <span className="text-sm font-light text-white/40 md:text-base">Your whole library, together</span>
          </h1>
          <p className="text-white/60">Totals, ratings, and favorites across everything you track</p>
        </motion.header>

        {loading ? (
          <StatsSkeleton />
        ) : grandTotal === 0 ? (
          <EmptyState
            contentType="movie"
            title="Nothing tracked yet"
            body="Add your first movie, show, or podcast and your dashboard fills in from there."
            actionLabel="Add a movie"
            onAction={() => navigate('/movies')}
          />
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard accent={primary} icon={Layers} label="Total Logged" value={grandTotal} delay={0.1} />
              <StatCard
                accent={primary}
                icon={Star}
                label="Average Rating"
                value={avgRating}
                decimals={1}
                caption="out of 10"
                delay={0.2}
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="glass rounded-xl p-5 neon-border-yellow"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon-yellow/40 bg-neon-yellow/20">
                    <TrendingUp className="text-neon-yellow" size={18} />
                  </div>
                  <h3 className="text-sm font-medium text-white/80">Top Genre Overall</h3>
                </div>
                <p className="truncate text-xl font-bold text-neon-yellow neon-text-yellow sm:text-2xl">
                  {topGenre ? topGenre.genre : 'N/A'}
                </p>
                {topGenre?.count ? (
                  <p className="mt-1 text-xs text-white/40">
                    {topGenre.count} title{topGenre.count === 1 ? '' : 's'}
                  </p>
                ) : null}
              </motion.div>
            </div>

            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">By type</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {Object.values(CONTENT_TYPES).map((ct, i) => {
                const a = accentFor(ct.key);
                const data = byType[ct.key];
                const Icon = iconFor(ct.key);
                return (
                  <motion.div
                    key={ct.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.3 }}
                  >
                    <Link
                      to={ct.path}
                      className={`glass flex items-center gap-3 rounded-xl p-4 transition-all hover:-translate-y-0.5 ${a.border}`}
                    >
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${a.ringSoft} ${a.bgSoft}`}>
                        <Icon className={a.text} size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white/70">{ct.nav}</p>
                        <p className={`text-lg font-bold ${a.text}`}>{data?.total || 0}</p>
                      </div>
                      {data?.total ? (
                        <div className="flex flex-shrink-0 items-center gap-1 text-sm text-white/50">
                          <Star size={14} className={a.text} />
                          {(data.avgRating || 0).toFixed(1)}
                        </div>
                      ) : null}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <FloatingCommandBar page="dashboard" />
    </div>
  );
}
