import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Globe, Lock } from 'lucide-react';
import { useBooks } from '../../utils/BookContext';
import { IS_CLOUD } from '../../utils/mode';
import { BOOK_GENRE_LIST } from '../../utils/genreColors';
import BookSearch from './BookSearch';
import { CONTENT_TYPES } from '../../utils/contentTypes';

const BOOK = CONTENT_TYPES.book;

const toForm = (p) => ({
  title: p?.title || '',
  rating: p?.rating || '',
  genre: p?.genre || '',
  date_watched: p?.date_watched || '',
  notes: p?.notes || '',
  author: p?.author || '',
  pages_read: p?.pages_read || '',
  page_count: p?.page_count || '',
  release_year: p?.release_year || '',
  // Preserved through edits so re-saving a looked-up book doesn't drop its cover.
  artwork_url: p?.artwork_url || '',
  is_public: p?.is_public !== false,
  status: p?.status || 'watched',
});

export default function EditBookModal({ isOpen, onClose, book }) {
  const { updateBook } = useBooks();
  const [formData, setFormData] = useState(() => toForm(book));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (book) setFormData(toForm(book));
  }, [book]);

  if (!isOpen || !book) return null;

  const isToRead = formData.status === 'to_watch';

  // Same semantics as the Add modal: picking a result overwrites the
  // catalog-sourced fields; only a genre MILO has a color for is adopted.
  // Notes, rating, pages read, and date are never touched.
  const applyLookup = (result) => {
    setFormData((prev) => ({
      ...prev,
      title: result.title,
      author: result.author || prev.author,
      // Only adopt a mapped genre; '' means Open Library's subjects didn't map
      // cleanly, so the user's choice (or blank) stays.
      genre: result.genre && BOOK_GENRE_LIST.includes(result.genre) ? result.genre : prev.genre,
      artwork_url: result.artwork_url || prev.artwork_url,
      page_count: result.page_count != null ? String(result.page_count) : prev.page_count,
      release_year: result.release_year != null ? String(result.release_year) : prev.release_year,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateBook(book.id, {
        ...formData,
        rating: isToRead ? null : parseFloat(formData.rating),
        date_watched: isToRead ? null : (formData.date_watched || null),
        pages_read: formData.pages_read ? parseInt(formData.pages_read) : null,
        page_count: formData.page_count ? parseInt(formData.page_count) : null,
        release_year: formData.release_year ? parseInt(formData.release_year) : null,
      });
      onClose();
    } catch (err) {
      alert('Failed to update book: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto neon-border-orange"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold neon-text-orange">Edit Book</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <BookSearch onPick={applyLookup} initialTerm={book.title} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
            >
              <option value="watched">{BOOK.verb}</option>
              <option value="to_watch">{BOOK.verbTo}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Title *</label>
            <div className="flex gap-3 items-start">
              {formData.artwork_url && (
                <img
                  src={formData.artwork_url}
                  alt=""
                  className="w-10 h-14 rounded-md object-cover flex-shrink-0 border border-white/10"
                />
              )}
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 rounded-lg glass"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Author</label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
              placeholder="e.g., Ursula K. Le Guin"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">Pages Read</label>
              <input
                type="number"
                min="0"
                value={formData.pages_read}
                onChange={(e) => setFormData({ ...formData, pages_read: e.target.value })}
                className="w-full px-4 py-3 rounded-lg glass"
                placeholder="#"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">Total Pages</label>
              <input
                type="number"
                min="0"
                value={formData.page_count}
                onChange={(e) => setFormData({ ...formData, page_count: e.target.value })}
                className="w-full px-4 py-3 rounded-lg glass"
                placeholder="#"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Year Published</label>
            <input
              type="number"
              min="1"
              max="2100"
              value={formData.release_year}
              onChange={(e) => setFormData({ ...formData, release_year: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
              placeholder="e.g., 1969"
            />
          </div>

          {!isToRead && (
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">Rating (1-10) *</label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.01"
                required
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                className="w-full px-4 py-3 rounded-lg glass"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Genre</label>
            <select
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
            >
              <option value="">Select genre</option>
              {/* A genre from an older row that isn't in the list would otherwise
                  silently reset to blank on save. */}
              {formData.genre && !BOOK_GENRE_LIST.includes(formData.genre) && (
                <option value={formData.genre}>{formData.genre}</option>
              )}
              {BOOK_GENRE_LIST.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>

          {!isToRead && (
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">Date {BOOK.verb}</label>
              <input
                type="date"
                value={formData.date_watched}
                onChange={(e) => setFormData({ ...formData, date_watched: e.target.value })}
                className="w-full px-4 py-3 rounded-lg glass"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass min-h-[100px]"
            />
          </div>

          {IS_CLOUD && (
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_public: !formData.is_public })}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg glass text-left"
              aria-pressed={formData.is_public}
            >
              <span className="flex items-center gap-2 text-white/80">
                {formData.is_public ? <Globe size={18} /> : <Lock size={18} />}
                <span className="text-sm font-medium">
                  {formData.is_public ? 'Visible to friends' : 'Private (only you)'}
                </span>
              </span>
              <span className={`text-xs px-2 py-1 rounded ${formData.is_public ? 'bg-neon-orange/20 text-neon-orange' : 'bg-white/10 text-white/60'}`}>
                {formData.is_public ? 'Public' : 'Private'}
              </span>
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-6 rounded-lg bg-neon-orange/20 border border-neon-orange/50 text-neon-orange font-semibold hover:bg-neon-orange/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed neon-text-orange"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </motion.div>
    </motion.div>,
    document.body
  );
}
