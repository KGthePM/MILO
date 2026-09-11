import { motion } from 'framer-motion';
import { Star, Calendar, Trash2, Edit, Tv, Layers, List, Check, Eye } from 'lucide-react';
import { useTVSeries } from '../../utils/TVSeriesContext';
import { useState, useEffect } from 'react';
import { getEffectiveGenreColors, subscribeUserPrefs } from '../../utils/userPrefs';
import { getGenreGlowStyle } from '../../utils/genreColors';
import { getRatingColor } from '../../utils/ratingColors';

export default function SeriesCard({ series, onEdit, onMarkWatched }) {
  const isToWatch = series.status === 'to_watch';
  const { deleteSeries } = useTVSeries();
  const [isDeleting, setIsDeleting] = useState(false);
  const [genreColors, setGenreColors] = useState(getEffectiveGenreColors);
  useEffect(() => subscribeUserPrefs(() => setGenreColors(getEffectiveGenreColors())), []);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${series.title}"?`)) {
      setIsDeleting(true);
      try {
        await deleteSeries(series.id);
      } catch (err) {
        alert('Failed to delete TV series');
        setIsDeleting(false);
      }
    }
  };

  const glowStyle = getGenreGlowStyle(series.genre, genreColors);
  const ratingClass = getRatingColor(series.rating);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      style={glowStyle}
      className="glass rounded-xl p-4 sm:p-5 border transition-all duration-300"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 flex-1">
          <Tv size={18} className="text-neon-magenta flex-shrink-0" />
          <h3 className="text-lg sm:text-xl font-bold text-white line-clamp-2">{series.title}</h3>
        </div>
        <div className="flex gap-1 sm:gap-2 flex-shrink-0">
          {isToWatch && onMarkWatched && (
            <button
              onClick={() => onMarkWatched(series)}
              className="p-2 sm:p-1.5 text-white/60 hover:text-amber-300 transition-colors"
              title="Mark as Watched"
            >
              <Check size={18} />
            </button>
          )}
          <button
            onClick={() => onEdit(series)}
            className="p-2 sm:p-1.5 text-white/60 hover:text-neon-magenta transition-colors"
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
        {isToWatch ? (
          <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
            <Eye size={12} /> To Watch
          </span>
        ) : (
          series.rating != null && (
            <div className={`flex items-center gap-1 ${ratingClass}`}>
              <Star size={16} fill="currentColor" />
              <span className="font-bold">{series.rating}</span>
              <span className="text-white/60 text-sm">/10</span>
            </div>
          )
        )}
        {series.genre && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-white/80">
            {series.genre}
          </span>
        )}
      </div>

      {series.release_year && (
        <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
          <span className="font-medium">Released:</span>
          <span>{series.release_year}</span>
        </div>
      )}

      {(series.num_seasons || series.total_episodes) && (
        <div className="flex gap-4 mb-2 text-white/70 text-sm">
          {series.num_seasons && (
            <div className="flex items-center gap-1">
              <Layers size={14} />
              <span>{series.num_seasons} Season{series.num_seasons !== 1 ? 's' : ''}</span>
            </div>
          )}
          {series.total_episodes && (
            <div className="flex items-center gap-1">
              <List size={14} />
              <span>{series.total_episodes} Episode{series.total_episodes !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {!isToWatch && (
        <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
          <Calendar size={14} />
          {series.date_watched ? (
            <span>{(() => {
              const [year, month, day] = series.date_watched.split('-');
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

      {series.notes && (
        <p className="text-white/70 text-sm line-clamp-2 mt-3 pt-3 border-t border-white/10">
          {series.notes}
        </p>
      )}
    </motion.div>
  );
}
