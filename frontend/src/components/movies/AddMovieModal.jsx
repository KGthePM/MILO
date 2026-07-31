import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Globe, Lock } from 'lucide-react';
import { useMovies } from '../../utils/MovieContext';
import { IS_CLOUD } from '../../utils/mode';

const genres = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror', 'Thriller', 'Romance', 'Animation', 'Documentary', 'Fantasy'];

export default function AddMovieModal({ isOpen, onClose, defaultStatus = 'watched', prefill = null }) {
  const { addMovie, updateMovieStatus } = useMovies();
  const initialForm = {
    title: '',
    rating: '',
    genre: '',
    date_watched: '',
    notes: '',
    director: '',
    release_year: '',
    is_public: true,
    status: defaultStatus,
    ...(prefill || {}),
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dupPrompt, setDupPrompt] = useState(null);

  if (!isOpen) return null;

  const isToWatch = formData.status === 'to_watch';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setDupPrompt(null);
    try {
      const payload = {
        ...formData,
        rating: isToWatch ? null : parseFloat(formData.rating),
        date_watched: isToWatch ? null : (formData.date_watched || null),
        release_year: formData.release_year ? parseInt(formData.release_year) : null,
      };
      await addMovie(payload);
      setFormData({ ...initialForm, status: defaultStatus });
      onClose();
    } catch (err) {
      const status = err?.status || err?.response?.status;
      const data = err?.data || err?.response?.data;
      if (status === 409 && data?.existingId) {
        setDupPrompt({ id: data.existingId, currentStatus: data.currentStatus });
      } else {
        alert('Failed to add movie: ' + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveExisting = async () => {
    if (!dupPrompt) return;
    try {
      await updateMovieStatus(dupPrompt.id, formData.status);
      setFormData({ ...initialForm, status: defaultStatus });
      setDupPrompt(null);
      onClose();
    } catch (err) {
      alert('Failed to move: ' + err.message);
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
        className="glass rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto neon-border-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold neon-text-cyan">
            {isToWatch ? 'Add to Watchlist' : 'Add New Movie'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {dupPrompt && (
          <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm">
            <p className="mb-2">
              "{formData.title}" is already in your{' '}
              <strong>{dupPrompt.currentStatus === 'watched' ? 'Watched' : 'To Watch'}</strong> list.
              Move it to <strong>{formData.status === 'watched' ? 'Watched' : 'To Watch'}</strong> instead?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleMoveExisting}
                className="px-3 py-1 rounded bg-amber-500/30 hover:bg-amber-500/40 text-amber-100"
              >
                Move it
              </button>
              <button
                type="button"
                onClick={() => setDupPrompt(null)}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 text-white/80"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
              placeholder="Enter movie title"
            />
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
              <span className={`text-xs px-2 py-1 rounded ${formData.is_public ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/10 text-white/60'}`}>
                {formData.is_public ? 'Public' : 'Private'}
              </span>
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-6 rounded-lg bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan font-semibold hover:bg-neon-cyan/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed neon-text-cyan"
          >
            {isSubmitting ? 'Adding...' : (isToWatch ? 'Add to Watchlist' : 'Add Movie')}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
