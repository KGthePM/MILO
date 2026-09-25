import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';
import { useBooks } from '../utils/BookContext';
import BookCard from '../components/books/BookCard';
import AddBookModal from '../components/books/AddBookModal';
import EditBookModal from '../components/books/EditBookModal';
import GoodreadsImportModal from '../components/books/GoodreadsImportModal';
import BookTimeline from '../components/books/BookTimeline';
import BookRecommendations from '../components/books/BookRecommendations';
import SearchFilter from '../components/shared/SearchFilter';
import GenreFilter from '../components/shared/GenreFilter';
import Stats from '../components/shared/Stats';
import FloatingCommandBar from '../components/shared/FloatingCommandBar';
import EmptyState from '../components/shared/EmptyState';
import SkeletonGrid from '../components/shared/SkeletonGrid';
import useAddFromQuery from '../components/onboarding/useAddFromQuery';
import { BOOK_GENRE_LIST } from '../utils/genreColors';
import { CONTENT_TYPES, ACCENT } from '../utils/contentTypes';

const BOOK = CONTENT_TYPES.book;
const A = ACCENT[BOOK.accent];
const GENRE_OPTIONS = ['All', ...BOOK_GENRE_LIST];

const tabClass = (active) =>
  `flex-1 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
    active
      ? `bg-gradient-to-r ${A.gradSoft} ${A.text} ${A.border}`
      : 'text-white/70 hover:text-white hover:bg-white/5'
  }`;

export default function BooksPage() {
  const { books, analytics, loading, error, fetchBooks } = useBooks();
  const [activeTab, setActiveTab] = useState('books');
  const [showAddModal, setShowAddModal] = useState(false);
  useAddFromQuery(setShowAddModal);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGoodreads, setShowGoodreads] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [filterParams, setFilterParams] = useState({ sortBy: 'most_recent' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('All time');
  const [sortBy, setSortBy] = useState('most_recent');

  const handleSearch = (value) => {
    setSearchTerm(value);
    const newParams = { ...filterParams, search: value || undefined };
    setFilterParams(newParams);
    fetchBooks(newParams);
  };

  const handleGenreChange = (genre) => {
    setSelectedGenre(genre);
    const newParams = { ...filterParams, genre: genre === 'All' ? undefined : genre };
    setFilterParams(newParams);
    fetchBooks(newParams);
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
    fetchBooks(newParams);
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
    fetchBooks(newParams);
  };

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
    const newParams = { ...filterParams, sortBy: newSortBy };
    setFilterParams(newParams);
    fetchBooks(newParams);
  };

  const read = books.filter((p) => (p.status || 'watched') === 'watched');
  const toRead = books.filter((p) => p.status === 'to_watch');

  const handleEdit = (book) => {
    setEditingBook(book);
    setShowEditModal(true);
  };

  const handleMarkRead = (book) => {
    setEditingBook({ ...book, status: 'watched' });
    setShowEditModal(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'books':
        return (
          <div className="space-y-6">
            <SearchFilter
              onSearch={handleSearch}
              searchTerm={searchTerm}
              placeholder="Search books..."
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
              <SkeletonGrid contentType="book" />
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                <p>{error}</p>
              </div>
            ) : read.length === 0 ? (
              <EmptyState
                contentType="book"
                variant={filtersActive ? 'filtered' : 'library'}
                onAction={() => setShowAddModal(true)}
                onClear={handleClearFilters}
                secondaryAction={{ label: 'or import your Goodreads library', onClick: () => setShowGoodreads(true) }}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {read.map((book, index) => (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      // Cap the stagger: index * 0.05 unbounded queued seconds
                      // of entrance animations on large libraries and froze
                      // navigation until they finished (iOS).
                      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
                      key={book.id}
                    >
                      <BookCard book={book} onEdit={handleEdit} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        );

      case 'to_read':
        return (
          <div className="space-y-6">
            {loading ? (
              <SkeletonGrid contentType="book" />
            ) : error ? (
              <div className="text-center py-12 text-red-400">
                <p>{error}</p>
              </div>
            ) : toRead.length === 0 ? (
              <EmptyState
                contentType="book"
                variant="watchlist"
                onAction={() => setShowAddModal(true)}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {[...toRead]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((book) => (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        key={book.id}
                      >
                        <BookCard
                          book={book}
                          onEdit={handleEdit}
                          onMarkRead={handleMarkRead}
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
        return loading ? <SkeletonGrid contentType="book" count={3} /> : <BookTimeline books={read} onEdit={handleEdit} />;

      case 'recommendations':
        return (
          <div className="space-y-6">
            <BookRecommendations />
            {analytics?.topGenres && analytics.topGenres.length > 1 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Genre Distribution</h3>
                <div className="space-y-3">
                  {analytics.topGenres.map((genre, index) => (
                    <div key={genre.genre} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/80">{genre.genre}</span>
                        <span className={A.text}>{genre.count} books</span>
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
              <span className="neon-text-orange">MI</span>
              <span className="neon-text-cyan">LO</span>
              <span className="text-sm md:text-base text-white/40 font-light ml-4">Movie Intelligence &amp; Learning Overseer</span>
            </h1>
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-0.5 flex-1 bg-gradient-to-r ${A.fade}`}></div>
              <span className="text-xl md:text-2xl font-medium text-white/80 tracking-wide">Books</span>
              <div className={`h-0.5 flex-1 bg-gradient-to-r ${A.fade}`}></div>
            </div>
            <p className="text-white/60">Track, discover, and analyze the books on your shelf</p>
          </div>
        </motion.header>

        <Stats analytics={analytics} type="book" loading={loading} />

        <motion.div className="mb-6 sm:mb-8 p-1 glass rounded-xl">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('books')} className={tabClass(activeTab === 'books')}>
              Books
            </button>
            <button
              onClick={() => setActiveTab('to_read')}
              className={`flex-1 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all ${
                activeTab === 'to_read'
                  ? `bg-amber-500/20 text-amber-300 ${A.border}`
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              {BOOK.verbTo}
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

      <AddBookModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultStatus={activeTab === 'to_read' ? 'to_watch' : 'watched'}
      />
      <GoodreadsImportModal isOpen={showGoodreads} onClose={() => setShowGoodreads(false)} />
      <EditBookModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        book={editingBook}
      />

      <FloatingCommandBar
        page="book"
        onAdd={() => setShowAddModal(true)}
        onRefresh={() => fetchBooks({ ...filterParams, sortBy })}
      />
    </div>
  );
}
