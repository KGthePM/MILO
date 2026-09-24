import { motion } from 'framer-motion';
import { Star, Calendar, Trash2, Edit, Mic, Headphones, Radio, Check } from 'lucide-react';
import { usePodcasts } from '../../utils/PodcastContext';
import { useState, useEffect } from 'react';
import { getEffectiveGenreColors, subscribeUserPrefs } from '../../utils/userPrefs';
import { getGenreGlowStyle } from '../../utils/genreColors';
import { getRatingColor } from '../../utils/ratingColors';
import { CONTENT_TYPES } from '../../utils/contentTypes';
import CoverArt from '../shared/CoverArt';

const PODCAST = CONTENT_TYPES.podcast;

export default function PodcastCard({ podcast, onEdit, onMarkListened }) {
  const isToListen = podcast.status === 'to_watch';
  const { deletePodcast } = usePodcasts();
  const [isDeleting, setIsDeleting] = useState(false);
  const [genreColors, setGenreColors] = useState(getEffectiveGenreColors);
  useEffect(() => subscribeUserPrefs(() => setGenreColors(getEffectiveGenreColors())), []);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${podcast.title}"?`)) {
      setIsDeleting(true);
      try {
        await deletePodcast(podcast.id);
      } catch {
        alert('Failed to delete podcast');
        setIsDeleting(false);
      }
    }
  };

  const glowStyle = getGenreGlowStyle(podcast.genre, genreColors);
  const ratingClass = getRatingColor(podcast.rating);
  // Publisher is only worth its own line when it differs from the host —
  // iTunes returns the same artistName for both on most independent shows.
  const showPublisher = podcast.publisher && podcast.publisher !== podcast.host;

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
          <CoverArt contentType="podcast" src={podcast.artwork_url} title={podcast.title} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Mic size={16} className="text-neon-purple flex-shrink-0" />
              <h3 className="text-lg sm:text-xl font-bold text-white line-clamp-2">{podcast.title}</h3>
            </div>
            {podcast.host && (
              <p className="text-white/70 text-sm mt-1 line-clamp-1">{podcast.host}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1 sm:gap-2 flex-shrink-0">
          {isToListen && onMarkListened && (
            <button
              onClick={() => onMarkListened(podcast)}
              className="p-2 sm:p-1.5 text-white/60 hover:text-amber-300 transition-colors"
              title={`Mark as ${PODCAST.verb}`}
            >
              <Check size={18} />
            </button>
          )}
          <button
            onClick={() => onEdit(podcast)}
            className="p-2 sm:p-1.5 text-white/60 hover:text-neon-purple transition-colors"
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
        {isToListen ? (
          <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
            <Headphones size={12} /> {PODCAST.verbTo}
          </span>
        ) : (
          podcast.rating != null && (
            <div className={`flex items-center gap-1 ${ratingClass}`}>
              <Star size={16} fill="currentColor" />
              <span className="font-bold">{podcast.rating}</span>
              <span className="text-white/60 text-sm">/10</span>
            </div>
          )
        )}
        {podcast.genre && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-white/80">
            {podcast.genre}
          </span>
        )}
      </div>

      {showPublisher && (
        <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
          <Radio size={14} />
          <span>{podcast.publisher}</span>
        </div>
      )}

      {(podcast.episodes_heard || podcast.total_episodes) && (
        <div className="flex gap-4 mb-2 text-white/70 text-sm">
          <div className="flex items-center gap-1">
            <Headphones size={14} />
            <span>
              {podcast.episodes_heard
                ? `${podcast.episodes_heard} heard`
                : `${podcast.total_episodes} episodes`}
              {podcast.episodes_heard && podcast.total_episodes
                ? ` of ${podcast.total_episodes}`
                : ''}
            </span>
          </div>
        </div>
      )}

      {!isToListen && (
        <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
          <Calendar size={14} />
          {podcast.date_watched ? (
            <span>{(() => {
              const [year, month, day] = podcast.date_watched.split('-');
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

      {podcast.notes && (
        <p className="text-white/70 text-sm line-clamp-2 mt-3 pt-3 border-t border-white/10">
          {podcast.notes}
        </p>
      )}
    </motion.div>
  );
}
