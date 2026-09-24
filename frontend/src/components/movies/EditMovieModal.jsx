import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Globe, Lock } from 'lucide-react';
import { useMovies } from '../../utils/MovieContext';
import { IS_CLOUD } from '../../utils/mode';
import MovieSearch from './MovieSearch';
import { TMDB_ENABLED } from '../../api/tmdbLookup';

const genres = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror', 'Thriller', 'Romance', 'Animation', 'Documentary', 'Fantasy'];

export default function EditMovieModal({ isOpen, onClose, movie }) {
  const { updateMovie } = useMovies();
  const [formData, setFormData] = useState({
    title: movie?.title || '',
    rating: movie?.rating || '',
    genre: movie?.genre || '',
    date_watched: movie?.date_watched || '',
    notes: movie?.notes || '',
    director: movie?.director || '',
    release_year: movie?.release_year || '',
    is_public: movie?.is_public !== false,
    status: movie?.status || 'watched',
    artwork_url: movie?.artwork_url || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (movie) {
      setFormData({
        title: movie.title || '',
        rating: movie.rating || '',
        genre: movie.genre || '',
        date_watched: movie.date_watched || '',
        notes: movie.notes || '',
        director: movie.director || '',
        release_year: movie.release_year || '',
        is_public: movie.is_public !== false,
        status: movie.status || 'watched',
        artwork_url: movie.artwork_url || '',
      });
    }
  }, [movie]);

  if (!isOpen || !movie) return null;

  const isToWatch = formData.status === 'to_watch';

  // Picking a TMDB result overwrites the title and fills the database-sourced
  // fields it actually returned; anything it lacked keeps the user's value.
  // Rating, notes, status, and date are never touched.
  const applyLookup = (d) => {
    setFormData((prev) => ({
      ...prev,
      title: d.title || prev.title,
      release_year: d.release_year ? String(d.release_year) : prev.release_year,
      director: d.director || prev.director,
      genre: d.genre || prev.genre,
      artwork_url: d.artwork_url || prev.artwork_url,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateMovie(movie.id, {
        ...formData,
        rating: isToWatch ? null : parseFloat(formData.rating),
        date_watched: isToWatch ? null : (formData.date_watched || null),
        release_year: formData.release_year ? parseInt(formData.release_year) : null,
      });
      onClose();
    } catch (err) {
      alert('Failed to update movie: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
        className="glass rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto neon-border-magenta"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold neon-text-magenta">Edit Movie</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {TMDB_ENABLED && <MovieSearch onPick={applyLookup} initialTerm={movie.title} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
            >
              <option value="watched">Watched</option>
              <option value="to_watch">To Watch</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Title *</label>
            <div className="flex gap-3 items-start">
              {formData.artwork_url && (
                <img
                  src={formData.artwork_url}
                  alt=""
                  className="w-8 h-12 rounded-md object-cover flex-shrink-0 border border-white/10"
                />
              )}
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 rounded-lg glass"
                placeholder="Enter movie title"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Director</label>
            <input
              type="text"
              value={formData.director}
              onChange={(e) => setFormData({ ...formData, director: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
              placeholder="Enter director name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Release Year</label>
            <input
              type="number"
              min="1900"
              max={new Date().getFullYear() + 1}
              step="1"
              value={formData.release_year}
              onChange={(e) => setFormData({ ...formData, release_year: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
              placeholder="e.g., 1978"
            />
          </div>

          {!isToWatch && (
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
                placeholder="Enter rating"
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
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          {!isToWatch && (
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">Date Watched</label>
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
              placeholder="Add your thoughts..."
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
              <span className={`text-xs px-2 py-1 rounded ${formData.is_public ? 'bg-neon-magenta/20 text-neon-magenta' : 'bg-white/10 text-white/60'}`}>
                {formData.is_public ? 'Public' : 'Private'}
              </span>
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-6 rounded-lg bg-neon-magenta/20 border border-neon-magenta/50 text-neon-magenta font-semibold hover:bg-neon-magenta/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed neon-text-magenta"
          >
            {isSubmitting ? 'Updating...' : 'Update Movie'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
