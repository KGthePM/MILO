import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';
import { usePodcasts } from '../utils/PodcastContext';
import PodcastCard from '../components/podcasts/PodcastCard';
import AddPodcastModal from '../components/podcasts/AddPodcastModal';
import EditPodcastModal from '../components/podcasts/EditPodcastModal';
import PodcastTimeline from '../components/podcasts/PodcastTimeline';
import PodcastRecommendations from '../components/podcasts/PodcastRecommendations';
import SearchFilter from '../components/shared/SearchFilter';
import GenreFilter from '../components/shared/GenreFilter';
import Stats from '../components/shared/Stats';
import FloatingCommandBar from '../components/shared/FloatingCommandBar';
import EmptyState from '../components/shared/EmptyState';
import SkeletonGrid from '../components/shared/SkeletonGrid';
import { PODCAST_GENRE_LIST } from '../utils/genreColors';
import { CONTENT_TYPES, ACCENT } from '../utils/contentTypes';

const PODCAST = CONTENT_TYPES.podcast;
const A = ACCENT[PODCAST.accent];
const GENRE_OPTIONS = ['All', ...PODCAST_GENRE_LIST];

const tabClass = (active) =>
  `flex-1 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
    active
      ? `bg-gradient-to-r ${A.gradSoft} ${A.text} ${A.border}`
      : 'text-white/70 hover:text-white hover:bg-white/5'
  }`;

export default function PodcastsPage() {
  const { podcasts, analytics, loading, error, fetchPodcasts } = usePodcasts();
  const [activeTab, setActiveTab] = useState('podcasts');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPodcast, setEditingPodcast] = useState(null);
  const [filterParams, setFilterParams] = useState({ sortBy: 'most_recent' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('All time');
  const [sortBy, setSortBy] = useState('most_recent');

  const handleSearch = (value) => {
    setSearchTerm(value);
    const newParams = { ...filterParams, search: value || undefined };
    setFilterParams(newParams);
    fetchPodcasts(newParams);
  };

  const handleGenreChange = (genre) => {
    setSelectedGenre(genre);
    const newParams = { ...filterParams, genre: genre === 'All' ? undefined : genre };
    setFilterParams(newParams);
    fetchPodcasts(newParams);
  };

  const handleDateRangeChange = (range) => {
    setSelectedDateRange(range);

    const dateRangeStart = (r) => {
      if (r === 'All time') return undefined;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysMap = { 'Last 7 days': 7, 'Last 30 days': 30, 'Last 90 days': 90 };
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - daysMap[r]);
      return startDate.toISOString().split('T')[0];
    };

    const newParams = { ...filterParams, startDate: dateRangeStart(range), sortBy };
    setFilterParams(newParams);
    fetchPodcasts(newParams);
  };

  // An empty grid means one of two different things, and they want
  // opposite affordances: a library with nothing in it wants an invitation
  // to add, while an active filter that matched nothing wants a way out.
  const filtersActive = Boolean(searchTerm) || selectedGenre !== 'All' || selectedDateRange !== 'All time';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedGenre('All');
    setSelectedDateRange('All time');
    const newParams = { sortBy };
    setFilterParams(newParams);
    fetchPodcasts(newParams);
  };

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
    const newParams = { ...filterParams, sortBy: newSortBy };
    setFilterParams(newParams);
    fetchPodcasts(newParams);
  };

  const listened = podcasts.filter((p) => (p.status || 'watched') === 'watched');
  const toListen = podcasts.filter((p) => p.status === 'to_watch');

  const handleEdit = (podcast) => {
    setEditingPodcast(podcast);
    setShowEditModal(true);
  };

  const handleMarkListened = (podcast) => {
    setEditingPodcast({ ...podcast, status: 'watched' });
    setShowEditModal(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'podcasts':
        return (
          <div className="space-y-6">
            <SearchFilter
              onSearch={handleSearch}
              searchTerm={searchTerm}
              placeholder="Search podcasts..."
              selectedDateRange={selectedDateRange}
              onDateRangeChange={handleDateRangeChange}
              sortBy={sortBy}
              onSortChange={handleSortChange}
            />
            <GenreFilter
              selectedGenre={selectedGenre}
              onGenreChange={handleGenreChange}
              genres={GENRE_OPTIONS}
            />
            {loading ? (
              <SkeletonGrid contentType="podcast" />
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                <p>{error}</p>
              </div>
            ) : listened.length === 0 ? (
              <EmptyState
                contentType="podcast"
                variant={filtersActive ? 'filtered' : 'library'}
                onAction={() => setShowAddModal(true)}
                onClear={handleClearFilters}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {listened.map((podcast, index) => (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      // Cap the stagger: index * 0.05 unbounded queued seconds
                      // of entrance animations on large libraries and froze
                      // navigation until they finished (iOS).
                      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
                      key={podcast.id}
                    >
                      <PodcastCard podcast={podcast} onEdit={handleEdit} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        );

      case 'to_listen':
        return (
          <div className="space-y-6">
            {loading ? (
              <SkeletonGrid contentType="podcast" />
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                <p>{error}</p>
              </div>
            ) : toListen.length === 0 ? (
              <EmptyState
                contentType="podcast"
                variant="watchlist"
                onAction={() => setShowAddModal(true)}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {[...toListen]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((podcast) => (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        key={podcast.id}
                      >
                        <PodcastCard
                          podcast={podcast}
                          onEdit={handleEdit}
                          onMarkListened={handleMarkListened}
                        />
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        );

      case 'timeline':
        // Guard on loading: watched* is [] until the fetch lands, and the
        // list below would otherwise state outright that there is no history.
        return loading ? <SkeletonGrid contentType="podcast" count={3} /> : <PodcastTimeline podcasts={listened} onEdit={handleEdit} />;

      case 'recommendations':
        return (
          <div className="space-y-6">
            <PodcastRecommendations />
            {analytics?.topGenres && analytics.topGenres.length > 1 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Genre Distribution</h3>
                <div className="space-y-3">
                  {analytics.topGenres.map((genre, index) => (
                    <div key={genre.genre} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/80">{genre.genre}</span>
                        <span className={A.text}>{genre.count} podcasts</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(genre.count / analytics.total) * 100}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className={`h-full bg-gradient-to-r ${A.gradVia} rounded-full`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen safe-area bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
      <div className="container mx-auto px-4 py-8 pb-40 sm:pb-32 max-w-7xl">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 flex items-center flex-wrap">
              <span className="neon-text-purple">MI</span>
              <span className="neon-text-cyan">LO</span>
              <span className="text-sm md:text-base text-white/40 font-light ml-4">Movie Intelligence &amp; Learning Overseer</span>
            </h1>
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-0.5 flex-1 bg-gradient-to-r ${A.fade}`}></div>
              <span className="text-xl md:text-2xl font-medium text-white/80 tracking-wide">Podcasts</span>
              <div className={`h-0.5 flex-1 bg-gradient-to-r ${A.fade}`}></div>
            </div>
            <p className="text-white/60">Track, discover, and analyze the shows in your ears</p>
          </div>
        </motion.header>

        <Stats analytics={analytics} type="podcast" loading={loading} />

        <motion.div className="mb-6 sm:mb-8 p-1 glass rounded-xl">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('podcasts')} className={tabClass(activeTab === 'podcasts')}>
              Podcasts
            </button>
            <button
              onClick={() => setActiveTab('to_listen')}
              className={`flex-1 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
                activeTab === 'to_listen'
                  ? `bg-amber-500/20 text-amber-300 ${A.border}`
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              {PODCAST.verbTo}
            </button>
            <button onClick={() => setActiveTab('timeline')} className={tabClass(activeTab === 'timeline')}>
              Timeline
            </button>
            <button onClick={() => setActiveTab('recommendations')} className={tabClass(activeTab === 'recommendations')}>
              <span className="sm:hidden">Recs</span>
              <span className="hidden sm:inline">Recommendations</span>
            </button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <AddPodcastModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultStatus={activeTab === 'to_listen' ? 'to_watch' : 'watched'}
      />
      <EditPodcastModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        podcast={editingPodcast}
      />

      <FloatingCommandBar
        page="podcast"
        onAdd={() => setShowAddModal(true)}
        onRefresh={() => fetchPodcasts({ ...filterParams, sortBy })}
      />
    </div>
  );
}
