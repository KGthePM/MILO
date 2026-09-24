import { useState } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Globe, Lock } from 'lucide-react';
import { usePodcasts } from '../../utils/PodcastContext';
import { IS_CLOUD } from '../../utils/mode';
import { PODCAST_GENRE_LIST } from '../../utils/genreColors';
import PodcastSearch from './PodcastSearch';
import { CONTENT_TYPES } from '../../utils/contentTypes';

const PODCAST = CONTENT_TYPES.podcast;

export default function AddPodcastModal({ isOpen, onClose, defaultStatus = 'watched', prefill = null }) {
  const { addPodcast, updatePodcastStatus } = usePodcasts();
  const initialForm = {
    title: '',
    rating: '',
    genre: '',
    date_watched: '',
    notes: '',
    host: '',
    publisher: '',
    episodes_heard: '',
    total_episodes: '',
    artwork_url: '',
    is_public: true,
    status: defaultStatus,
    ...(prefill || {}),
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dupPrompt, setDupPrompt] = useState(null);

  if (!isOpen) return null;

  // `to_watch` is the stored status for both watchlists — podcasts only differ
  // in the label ("To Listen"), so AI filtering on status stays consistent.
  const isToListen = formData.status === 'to_watch';

  const applyLookup = (result) => {
    setFormData((prev) => ({
      ...prev,
      title: result.title,
      host: result.host,
      publisher: result.publisher,
      // Only adopt a looked-up genre MILO has a color for; otherwise leave the
      // user's choice (or blank) rather than injecting an unknown value.
      genre: PODCAST_GENRE_LIST.includes(result.genre) ? result.genre : prev.genre,
      artwork_url: result.artwork_url,
      total_episodes: result.total_episodes != null ? String(result.total_episodes) : prev.total_episodes,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setDupPrompt(null);
    try {
      await addPodcast({
        ...formData,
        rating: isToListen ? null : parseFloat(formData.rating),
        date_watched: isToListen ? null : (formData.date_watched || null),
        episodes_heard: formData.episodes_heard ? parseInt(formData.episodes_heard) : null,
        total_episodes: formData.total_episodes ? parseInt(formData.total_episodes) : null,
      });
      setFormData({ ...initialForm, status: defaultStatus });
      onClose();
    } catch (err) {
      if (err?.status === 409 && err?.data?.existingId) {
        setDupPrompt({ id: err.data.existingId, currentStatus: err.data.currentStatus });
      } else {
        alert('Failed to add podcast: ' + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveExisting = async () => {
    if (!dupPrompt) return;
    try {
      await updatePodcastStatus(dupPrompt.id, formData.status);
      setFormData({ ...initialForm, status: defaultStatus });
      setDupPrompt(null);
      onClose();
    } catch (err) {
      alert('Failed to move: ' + err.message);
    }
  };

  const statusLabel = (s) => (s === 'watched' ? PODCAST.verb : PODCAST.verbTo);

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
        className="glass rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto neon-border-purple"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold neon-text-purple">
            {isToListen ? 'Add to Listen List' : 'Add New Podcast'}
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {dupPrompt && (
          <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm">
            <p className="mb-2">
              "{formData.title}" is already in your{' '}
              <strong>{statusLabel(dupPrompt.currentStatus)}</strong> list.
              Move it to <strong>{statusLabel(formData.status)}</strong> instead?
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

        <PodcastSearch onPick={applyLookup} />

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
                placeholder="Enter podcast name"
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
              placeholder="e.g., PJ Vogt"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Network / Publisher</label>
            <input
              type="text"
              value={formData.publisher}
              onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
              className="w-full px-4 py-3 rounded-lg glass"
              placeholder="e.g., Odyssey"
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
              placeholder="Favorite episodes, why you like it..."
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
            {isSubmitting ? 'Adding...' : (isToListen ? 'Add to Listen List' : 'Add Podcast')}
          </button>
        </form>
      </motion.div>
    </motion.div>,
    document.body
  );
}
