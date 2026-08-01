import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Brain, Loader2, AlertCircle, Plus } from 'lucide-react';
import { assistantApi } from '../../api/assistantApi';
import { useMovies } from '../../utils/MovieContext';
import { useTVSeries } from '../../utils/TVSeriesContext';

const quickActions = [
  'Find similar movies',
  'Find similar TV shows',
  'Recommend hidden gems',
  'Analyze my taste',
  'What should I watch this weekend?'
];

const STORAGE_KEY = 'milo.conversation.v1';
const MAX_MESSAGES = 20;

function loadStoredMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AssistantModal({ isOpen, onClose }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(() => loadStoredMessages());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const transcriptRef = useRef(null);

  const { movies, analytics: movieAnalytics } = useMovies();
  const { series, analytics: tvAnalytics } = useTVSeries();

  const combinedMovies = movies;
  const combinedTV = series;
  const combinedAnalytics = {
    totalWatched: (movieAnalytics?.total || 0) + (tvAnalytics?.total || 0),
    averageRating: movieAnalytics?.total && tvAnalytics?.total
      ? ((movieAnalytics.avgRating * movieAnalytics.total + tvAnalytics.avgRating * tvAnalytics.total) / (movieAnalytics.total + tvAnalytics.total))
      : (movieAnalytics?.avgRating || tvAnalytics?.avgRating || 0)
  };

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await assistantApi.getOllamaModels();
        setModels(data.models || []);
        if (data.models && data.models.length > 0) {
          setSelectedModel(data.models[0]);
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    try {
      if (messages.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        const trimmed = messages.slice(-MAX_MESSAGES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      }
    } catch {
      // ignore quota errors
    }
  }, [messages]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = async (msg = null) => {
    const userMessage = msg || message;
    if (!userMessage.trim() || loading) return;

    const priorHistory = messages
      .slice(-MAX_MESSAGES)
      .map(({ role, content }) => ({ role, content }));

    const userTurn = { role: 'user', content: userMessage, ts: Date.now() };
    setMessages((prev) => [...prev, userTurn]);
    setLoading(true);
    setError(null);
    setMessage('');

    try {
      const result = await assistantApi.chatWithAssistant(
        userMessage,
        selectedModel,
        combinedMovies,
        combinedTV,
        combinedAnalytics,
        priorHistory
      );
      const responseText = (result.response || '').trim();
      if (!responseText) {
        throw new Error('MILO returned an empty response. Try again or pick a different model.');
      }
      const assistantTurn = { role: 'assistant', content: responseText, ts: Date.now() };
      setMessages((prev) => [...prev, assistantTurn]);
      setSelectedModel(result.modelUsed || selectedModel);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    handleSubmit(action);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNewConversation = () => {
    if (messages.length === 0 && !error) return;
    if (messages.length > 0 && !window.confirm('Start a new conversation? Current chat will be cleared.')) {
      return;
    }
    setMessages([]);
    setError(null);
    setMessage('');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const showIntro = messages.length === 0 && !loading && !error;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass rounded-2xl p-6 w-full max-w-lg neon-border-purple max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Brain className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">MILO</h2>
                  <p className="text-xs text-white/60">Movie Intelligence & Learning Overseer</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNewConversation}
                  disabled={messages.length === 0 && !error}
                  title="New conversation"
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Plus size={18} className="text-white/70" />
                  <span className="text-xs text-white/70 pr-1">New</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} className="text-white/70" />
                </button>
              </div>
            </div>

            {models.length > 0 && (
              <div className="mb-4">
                <label className="text-xs text-white/60 mb-2 block">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                >
                  {models.map((model) => (
                    <option key={model} value={model} className="bg-gray-900">
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div ref={transcriptRef} className="flex-1 overflow-y-auto mb-4 space-y-3">
              {showIntro && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4"
                >
                  <p className="text-white/90 text-sm leading-relaxed">
                    Hello! I'm <strong className="text-purple-400">MILO</strong>, your AI assistant. How can I help you discover your next favorite movie or TV show?
                  </p>
                </motion.div>
              )}

              {messages.map((m, idx) => (
                <motion.div
                  key={`${m.ts}-${idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-500/30 text-white'
                        : 'bg-white/5 border border-white/10 text-white/90'
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3"
                >
                  <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-red-400 text-sm font-medium mb-1">Something went wrong</p>
                    <p className="text-white/70 text-sm">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="mt-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}

              {loading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 text-white/70"
                >
                  <Loader2 size={18} className="animate-spin text-purple-400" />
                  <span className="text-sm">MILO is thinking...</span>
                </motion.div>
              )}
            </div>

            {showIntro && (
              <div className="mb-4">
                <p className="text-xs text-white/50 mb-2">Quick actions</p>
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      onClick={() => handleQuickAction(action)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-full text-xs text-white/80 hover:text-white transition-all"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask MILO anything..."
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/40 focus:outline-none focus:border-purple-500/50 transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => handleSubmit()}
                disabled={loading || !message.trim()}
                className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center justify-center"
              >
                <Send size={18} className="text-white" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
