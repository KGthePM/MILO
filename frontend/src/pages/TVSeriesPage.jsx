import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tv } from 'lucide-react';
import { useTVSeries } from '../utils/TVSeriesContext';
import SeriesCard from '../components/tv/SeriesCard';
import AddTVSeriesModal from '../components/tv/AddTVSeriesModal';
import EditTVSeriesModal from '../components/tv/EditTVSeriesModal';
import SearchFilter from '../components/shared/SearchFilter';
import GenreFilter from '../components/shared/GenreFilter';
import TVRecommendations from '../components/tv/TVRecommendations';
import TVTimeline from '../components/tv/TVTimeline';
import Stats from '../components/shared/Stats';
import FloatingCommandBar from '../components/shared/FloatingCommandBar';
import EmptyState from '../components/shared/EmptyState';
import SkeletonGrid from '../components/shared/SkeletonGrid';
import useAddFromQuery from '../components/onboarding/useAddFromQuery';

function TVSeriesPageContent() {
  const { series, analytics, loading, error, fetchSeries } = useTVSeries();
  const [activeTab, setActiveTab] = useState('series');
  const [showAddModal, setShowAddModal] = useState(false);
  useAddFromQuery(setShowAddModal);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);
  const [filterParams, setFilterParams] = useState({ sortBy: 'most_recent' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('All time');
  const [sortBy, setSortBy] = useState('most_recent');

  const handleSearch = (value) => {
    setSearchTerm(value);
    const newParams = { ...filterParams, search: value || undefined };
    setFilterParams(newParams);
    fetchSeries(newParams);
  };

  const handleGenreChange = (genre) => {
    setSelectedGenre(genre);
    const newParams = { ...filterParams, genre: genre === 'All' ? undefined : genre };
    setFilterParams(newParams);
    fetchSeries(newParams);
  };

  const handleDateRangeChange = (range) => {
    setSelectedDateRange(range);
    
    const dateRangeStart = (range) => {
      if (range === 'All time') return undefined;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const daysMap = {
        'Last 7 days': 7,
        'Last 30 days': 30,
        'Last 90 days': 90
      };
      
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - daysMap[range]);
      return startDate.toISOString().split('T')[0];
    };
    
    const newParams = { 
      ...filterParams, 
      startDate: dateRangeStart(range),
      sortBy 
    };
    setFilterParams(newParams);
    fetchSeries(newParams);
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
    fetchSeries(newParams);
  };

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
    const newParams = { ...filterParams, sortBy: newSortBy };
    setFilterParams(newParams);
    fetchSeries(newParams);
  };

  const watchedSeries = series.filter(s => (s.status || 'watched') === 'watched');
  const toWatchSeries = series.filter(s => s.status === 'to_watch');

  const handleEdit = (tvSeries) => {
    setEditingSeries(tvSeries);
    setShowEditModal(true);
  };

  const handleMarkWatched = (tvSeries) => {
    setEditingSeries({ ...tvSeries, status: 'watched' });
    setShowEditModal(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'series':
        return (
          <div className="space-y-6">
            <SearchFilter 
              onSearch={handleSearch} 
              searchTerm={searchTerm} 
              placeholder="Search TV series..."
              selectedDateRange={selectedDateRange}
              onDateRangeChange={handleDateRangeChange}
              sortBy={sortBy}
              onSortChange={handleSortChange}
            />
            <GenreFilter selectedGenre={selectedGenre} onGenreChange={handleGenreChange} />
            {loading ? (
              <SkeletonGrid contentType="tv" />
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                <p>{error}</p>
              </div>
            ) : watchedSeries.length === 0 ? (
              <EmptyState
                contentType="tv"
                variant={filtersActive ? 'filtered' : 'library'}
                onAction={() => setShowAddModal(true)}
                onClear={handleClearFilters}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {watchedSeries.map((tvSeries, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
                  key={tvSeries.id}
                >
                  <SeriesCard series={tvSeries} onEdit={handleEdit} />
                </motion.div>
              ))}
            </AnimatePresence>
              </div>
            )}
          </div>
        );

      case 'to_watch':
        return (
          <div className="space-y-6">
            {loading ? (
              <SkeletonGrid contentType="tv" />
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                <p>{error}</p>
              </div>
            ) : toWatchSeries.length === 0 ? (
              <EmptyState
                contentType="tv"
                variant="watchlist"
                onAction={() => setShowAddModal(true)}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {[...toWatchSeries]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((tvSeries) => (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        key={tvSeries.id}
                      >
                        <SeriesCard
                          series={tvSeries}
                          onEdit={handleEdit}
                          onMarkWatched={handleMarkWatched}
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
        return loading ? <SkeletonGrid contentType="tv" count={3} /> : <TVTimeline series={watchedSeries} onEdit={handleEdit} />;

      case 'recommendations':
        return (
          <div className="space-y-6">
            <TVRecommendations analytics={analytics} />
            {analytics?.topGenres && analytics.topGenres.length > 1 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Genre Distribution</h3>
                <div className="space-y-3">
                  {analytics.topGenres.map((genre, index) => (
                    <div key={genre.genre} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/80">{genre.genre}</span>
                        <span className="text-neon-magenta">{genre.count} series</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(genre.count / analytics.total) * 100}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="h-full bg-gradient-to-r from-neon-magenta via-neon-purple to-neon-magenta rounded-full"
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
              <span className="neon-text-magenta">MI</span>
              <span className="neon-text-cyan">LO</span>
              <span className="text-sm md:text-base text-white/40 font-light ml-4">Media Intelligence & Learning Overseer</span>
            </h1>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-neon-magenta/50 to-transparent"></div>
              <span className="text-xl md:text-2xl font-medium text-white/80 tracking-wide">TV Series</span>
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-neon-magenta/50 to-transparent"></div>
            </div>
            <p className="text-white/60">Track, discover, and analyze your TV series journey</p>
          </div>
        </motion.header>

        <Stats analytics={analytics} type="tv" loading={loading} />

        <motion.div className="mb-6 sm:mb-8 p-1 glass rounded-xl">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('series')}
              className={`flex-1 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
                activeTab === 'series'
                  ? 'bg-gradient-to-r from-neon-magenta/20 to-neon-purple/20 text-neon-magenta neon-border-magenta'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              TV Series
            </button>
            <button
              onClick={() => setActiveTab('to_watch')}
              className={`flex-1 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
                activeTab === 'to_watch'
                  ? 'bg-amber-500/20 text-amber-300 neon-border-magenta'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              To Watch
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
                activeTab === 'timeline'
                  ? 'bg-gradient-to-r from-neon-magenta/20 to-neon-purple/20 text-neon-magenta neon-border-magenta'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`flex-1 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
                activeTab === 'recommendations'
                  ? 'bg-gradient-to-r from-neon-magenta/20 to-neon-purple/20 text-neon-magenta neon-border-magenta'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
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

      <AddTVSeriesModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultStatus={activeTab === 'to_watch' ? 'to_watch' : 'watched'}
      />
      <EditTVSeriesModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} series={editingSeries} />

      <FloatingCommandBar
        page="tv"
        onAdd={() => setShowAddModal(true)}
        onRefresh={() => fetchSeries({ ...filterParams, sortBy })}
      />
    </div>
  );
}

export default function TVSeriesPage() {
  return <TVSeriesPageContent />;
}
