import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Globe, Lock } from 'lucide-react';
import { usePodcasts } from '../../utils/PodcastContext';
import { IS_CLOUD } from '../../utils/mode';
import { PODCAST_GENRE_LIST } from '../../utils/genreColors';
import { CONTENT_TYPES } from '../../utils/contentTypes';

const PODCAST = CONTENT_TYPES.podcast;

const toForm = (p) => ({
  title: p?.title || '',
  rating: p?.rating || '',
  genre: p?.genre || '',
  date_watched: p?.date_watched || '',
  notes: p?.notes || '',
  host: p?.host || '',
  publisher: p?.publisher || '',
  episodes_heard: p?.episodes_heard || '',
  total_episodes: p?.total_episodes || '',
  // Preserved through edits so re-saving a looked-up show doesn't drop its art.
  artwork_url: p?.artwork_url || '',
  is_public: p?.is_public !== false,
  status: p?.status || 'watched',
});

export default function EditPodcastModal({ isOpen, onClose, podcast }) {
  const { updatePodcast } = usePodcasts();
  const [formData, setFormData] = useState(() => toForm(podcast));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (podcast) setFormData(toForm(podcast));
  }, [podcast]);

  if (!isOpen || !podcast) return null;

  const isToListen = formData.status === 'to_watch';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updatePodcast(podcast.id, {
        ...formData,
        rating: isToListen ? null : parseFloat(formData.rating),
        date_watched: isToListen ? null : (formData.date_watched || null),
        episodes_heard: formData.episodes_heard ? parseInt(formData.episodes_heard) : null,
        total_episodes: formData.total_episodes ? parseInt(formData.total_episodes) : null,
      });
      onClose();
    } catch (err) {
      alert('Failed to update podcast: ' + err.message);
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
        className="glass rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto neon-border-purple"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold neon-text-purple">Edit Podcast</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
            >
              <option value="watched">{PODCAST.verb}</option>
              <option value="to_watch">{PODCAST.verbTo}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Podcast Name *</label>
            <div className="flex gap-3 items-start">
              {formData.artwork_url && (
                <img
                  src={formData.artwork_url}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white/10"
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
            <label className="block text-sm font-medium mb-2 text-white/80">Host</label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Network / Publisher</label>
            <input
              type="text"
              value={formData.publisher}
              onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">Episodes Heard</label>
              <input
                type="number"
                min="0"
                value={formData.episodes_heard}
                onChange={(e) => setFormData({ ...formData, episodes_heard: e.target.value })}
                className="w-full px-4 py-3 rounded-lg glass"
                placeholder="#"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">Total Episodes</label>
              <input
                type="number"
                min="0"
                value={formData.total_episodes}
                onChange={(e) => setFormData({ ...formData, total_episodes: e.target.value })}
                className="w-full px-4 py-3 rounded-lg glass"
                placeholder="#"
              />
            </div>
          </div>

          {!isToListen && (
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
              {formData.genre && !PODCAST_GENRE_LIST.includes(formData.genre) && (
                <option value={formData.genre}>{formData.genre}</option>
              )}
              {PODCAST_GENRE_LIST.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>

          {!isToListen && (
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">Date {PODCAST.verb}</label>
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
              <span className={`text-xs px-2 py-1 rounded ${formData.is_public ? 'bg-neon-purple/20 text-neon-purple' : 'bg-white/10 text-white/60'}`}>
                {formData.is_public ? 'Public' : 'Private'}
              </span>
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-6 rounded-lg bg-neon-purple/20 border border-neon-purple/50 text-neon-purple font-semibold hover:bg-neon-purple/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed neon-text-purple"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
