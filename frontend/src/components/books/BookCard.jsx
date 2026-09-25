import { motion } from 'framer-motion';
import { Star, Calendar, Trash2, Edit, BookOpen, Bookmark, Check } from 'lucide-react';
import { useBooks } from '../../utils/BookContext';
import { useState, useEffect } from 'react';
import { getEffectiveGenreColors, subscribeUserPrefs } from '../../utils/userPrefs';
import { getGenreGlowStyle } from '../../utils/genreColors';
import { getRatingColor } from '../../utils/ratingColors';
import { CONTENT_TYPES } from '../../utils/contentTypes';
import CoverArt from '../shared/CoverArt';

const BOOK = CONTENT_TYPES.book;

export default function BookCard({ book, onEdit, onMarkRead }) {
  const isToRead = book.status === 'to_watch';
  const { deleteBook } = useBooks();
  const [isDeleting, setIsDeleting] = useState(false);
  const [genreColors, setGenreColors] = useState(getEffectiveGenreColors);
  useEffect(() => subscribeUserPrefs(() => setGenreColors(getEffectiveGenreColors())), []);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${book.title}"?`)) {
      setIsDeleting(true);
      try {
        await deleteBook(book.id);
      } catch {
        alert('Failed to delete book');
        setIsDeleting(false);
      }
    }
  };

  const glowStyle = getGenreGlowStyle(book.genre, genreColors);
  const ratingClass = getRatingColor(book.rating);
  // Progress only reads as a fraction when both numbers are known and sane.
  const progress = book.pages_read && book.page_count
    ? Math.min(book.pages_read / book.page_count, 1)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      style={glowStyle}
      className="glass rounded-xl p-4 sm:p-5 border transition-all duration-300"
    >
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <CoverArt contentType="book" src={book.artwork_url} title={book.title} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-neon-orange flex-shrink-0" />
              <h3 className="text-lg sm:text-xl font-bold text-white line-clamp-2">{book.title}</h3>
            </div>
            {(book.author || book.release_year) && (
              <p className="text-white/70 text-sm mt-1 line-clamp-1">
                {[book.author, book.release_year].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1 sm:gap-2 flex-shrink-0">
          {isToRead && onMarkRead && (
            <button
              onClick={() => onMarkRead(book)}
              className="p-2 sm:p-1.5 text-white/60 hover:text-amber-300 transition-colors"
              title={`Mark as ${BOOK.verb}`}
            >
              <Check size={18} />
            </button>
          )}
          <button
            onClick={() => onEdit(book)}
            className="p-2 sm:p-1.5 text-white/60 hover:text-neon-orange transition-colors"
            title="Edit"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 sm:p-1.5 text-white/60 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {isToRead ? (
          <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
            <Bookmark size={12} /> {BOOK.verbTo}
          </span>
        ) : (
          book.rating != null && (
            <div className={`flex items-center gap-1 ${ratingClass}`}>
              <Star size={16} fill="currentColor" />
              <span className="font-bold">{book.rating}</span>
              <span className="text-white/60 text-sm">/10</span>
            </div>
          )
        )}
        {book.genre && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-white/80">
            {book.genre}
          </span>
        )}
      </div>

      {(book.pages_read || book.page_count) && (
        <div className="mb-2 text-white/70 text-sm">
          <div className="flex items-center gap-1">
            <BookOpen size={14} />
            <span>
              {book.pages_read
                ? `${book.pages_read} pages read`
                : `${book.page_count} pages`}
              {book.pages_read && book.page_count ? ` of ${book.page_count}` : ''}
            </span>
          </div>
          {progress != null && progress < 1 && (
            <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-neon-orange/70" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {!isToRead && (
        <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
          <Calendar size={14} />
          {book.date_watched ? (
            <span>{(() => {
              const [year, month, day] = book.date_watched.split('-');
              return new Date(year, month - 1, day).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
            })()}</span>
          ) : (
            <span>No date</span>
          )}
        </div>
      )}

      {book.notes && (
        <p className="text-white/70 text-sm line-clamp-2 mt-3 pt-3 border-t border-white/10">
          {book.notes}
        </p>
      )}
    </motion.div>
  );
}
