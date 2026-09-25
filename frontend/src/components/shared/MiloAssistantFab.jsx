import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import AssistantModal from './AssistantModal';
import miloIcon from '/milo-ai-icon.jpeg';
import { useMovies } from '../../utils/MovieContext';
import { useTVSeries } from '../../utils/TVSeriesContext';
import { usePodcasts } from '../../utils/PodcastContext';
import { useBooks } from '../../utils/BookContext';
import { markHintSeen } from '../../utils/userPrefs';
import useOnboarding from '../onboarding/useOnboarding';

const messages = [
  'Chat with MILO',
  'Need movie recs?',
  'Ask me anything!',
  'What should I watch?',
  "MILO's got you covered",
  "Let's find something good",
];

// One-time discovery bubble. The hover tooltip above never fires on touch, so
// on iOS nothing ever said what this button is. Held until the library has
// enough in it for the assistant to have something to say.
const HINT_ID = 'assistant-fab';
const HINT_MIN_WATCHED = 3;

const countWatched = (...lists) =>
  lists.reduce((n, list) => n + (list || []).filter((i) => i.status === 'watched').length, 0);

export default function MiloAssistantFab() {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');
  const reduceMotion = useReducedMotion();

  const { movies } = useMovies();
  const { series } = useTVSeries();
  const { podcasts } = usePodcasts();
  const { books } = useBooks();
  const { introSeen, hints } = useOnboarding();
  const showHint =
    introSeen && !hints[HINT_ID] && !isAssistantOpen &&
    countWatched(movies, series, podcasts, books) >= HINT_MIN_WATCHED;

  const openAssistant = () => {
    setIsAssistantOpen(true);
    if (showHint) markHintSeen(HINT_ID);
  };

  const handleMouseEnter = () => {
    setTooltipMessage(messages[Math.floor(Math.random() * messages.length)]);
    setShowTooltip(true);
  };

  return (
    <>
      <AnimatePresence>
        {showTooltip && !showHint && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-40 right-[calc(0.75rem_+_env(safe-area-inset-right))] sm:bottom-48 sm:right-[calc(1rem_+_env(safe-area-inset-right))] glass rounded-lg px-3 py-1.5 text-xs text-white shadow-lg pointer-events-none z-50 whitespace-nowrap"
          >
            {tooltipMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.6 }}
            role="note"
            className="fixed bottom-40 right-[calc(0.75rem_+_env(safe-area-inset-right))] sm:bottom-48 sm:right-[calc(1rem_+_env(safe-area-inset-right))] z-40 flex items-start gap-2 max-w-[15rem] glass rounded-xl border border-white/20 pl-3.5 pr-2 py-2.5"
          >
            <button type="button" onClick={openAssistant} className="text-left text-sm text-white/90 leading-snug">
              Ask me what to watch tonight — I've read your whole library.
            </button>
            <button
              type="button"
              onClick={() => markHintSeen(HINT_ID)}
              aria-label="Dismiss"
              className="shrink-0 p-0.5 text-white/40 hover:text-white"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={openAssistant}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label="Open MILO assistant"
        className="fixed bottom-24 right-[calc(0.75rem_+_env(safe-area-inset-right))] w-14 h-14 sm:bottom-24 sm:right-[calc(1rem_+_env(safe-area-inset-right))] sm:w-20 sm:h-20 border-2 border-white/20 flex items-center justify-center transition-all z-40 rounded-full sm:rounded-none bg-bg-primary/60 sm:bg-transparent"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Three pulses, then still — a bounded animation, never an infinite
            loop (DESIGN.md §3). Skipped entirely under reduced motion. */}
        {showHint && !reduceMotion && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full sm:rounded-none border-2 border-white/60 pointer-events-none"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 1.45, opacity: 0 }}
            transition={{ duration: 1.4, repeat: 2, ease: 'easeOut', delay: 0.6 }}
          />
        )}
        <img src={miloIcon} alt="MILO AI" className="w-10 h-10 sm:w-16 sm:h-16 object-contain sm:drop-shadow-lg" />
      </motion.button>

      <AssistantModal isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
    </>
  );
}
