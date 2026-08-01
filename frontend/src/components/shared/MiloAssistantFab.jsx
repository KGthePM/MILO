import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AssistantModal from './AssistantModal';
import miloIcon from '/milo-ai-icon.jpeg';

const messages = [
  'Chat with MILO',
  'Need movie recs?',
  'Ask me anything!',
  'What should I watch?',
  "MILO's got you covered",
  "Let's find something good",
];

export default function MiloAssistantFab() {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');

  const handleMouseEnter = () => {
    setTooltipMessage(messages[Math.floor(Math.random() * messages.length)]);
    setShowTooltip(true);
  };

  return (
    <>
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-40 right-3 sm:bottom-48 sm:right-4 glass rounded-lg px-3 py-1.5 text-xs text-white shadow-lg pointer-events-none z-50 whitespace-nowrap"
          >
            {tooltipMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsAssistantOpen(true)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        className="fixed bottom-24 right-3 w-14 h-14 sm:bottom-24 sm:right-4 sm:w-20 sm:h-20 border-2 border-white/20 flex items-center justify-center transition-all z-40 rounded-full sm:rounded-none bg-bg-primary/60 sm:bg-transparent"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <img src={miloIcon} alt="MILO AI" className="w-10 h-10 sm:w-16 sm:h-16 object-contain sm:drop-shadow-lg" />
      </motion.button>

      <AssistantModal isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
    </>
  );
}
