import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { accentFor } from '../../utils/contentTypes';
import { markHintSeen } from '../../utils/userPrefs';
import useOnboarding from './useOnboarding';

// One-time inline callout that sits in normal layout flow next to the feature
// it explains — no measuring or floating over the page, so there is nothing to
// mis-position on rotation or when the target moves.
//
// Held back while the intro reel is still up (introSeen false) so a new user
// never gets the reel and a hint at the same moment. Dismissal is per device
// and permanent until "Show tips again" in Settings → Appearance.
export default function DiscoveryHint({ id, contentType = 'movie', children, className = '' }) {
  const { introSeen, hints } = useOnboarding();
  const reduceMotion = useReducedMotion();
  const A = accentFor(contentType);
  const visible = introSeen && !hints[id];

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="note"
          className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${A.tileSoft} ${A.edgeSoft} ${className}`}
        >
          <Sparkles size={16} className={`${A.text} shrink-0 mt-0.5`} />
          <p className="flex-1 text-sm text-white/80 leading-snug text-left">{children}</p>
          <button
            type="button"
            onClick={() => markHintSeen(id)}
            className={`shrink-0 text-xs font-semibold px-2 py-0.5 -my-0.5 rounded-md transition-colors ${A.text} hover:bg-white/10`}
          >
            Got it
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
