import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, Filter, Loader2, AlertCircle, Play, Settings as SettingsIcon, Brain, ThumbsUp, ThumbsDown, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api as movieApi } from '../../api/movieApi';
import { tvApi } from '../../api/tvApi';
import { api as tasteApi } from '../../api/tasteApi';
import { api as feedbackApi } from '../../api/feedbackApi';
import { normalizeTitle } from '../../ai/prompt';
import { useMovies } from '../../utils/MovieContext';
import { useTVSeries } from '../../utils/TVSeriesContext';
import { IS_CLOUD } from '../../utils/mode';
import { loadAISettings, getActiveKey } from '../../utils/aiSettings';

function formatWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function pickBestModel(list) {
  if (!list || list.length === 0) return '';
  const score = (name) => {
    let s = 0;
    const sizeMatch = name.match(/:(\d+(?:\.\d+)?)b/i);
    if (sizeMatch) s += parseFloat(sizeMatch[1]) * 10;
    if (/qwen3/i.test(name)) s += 100;
    else if (/qwen2/i.test(name)) s += 50;
    return s;
  };
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

export default function EnhancedRecommendations({ contentType = 'movie' }) {
  const [hasStarted, setHasStarted] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [cloudSettings, setCloudSettings] = useState(() => (IS_CLOUD ? loadAISettings() : null));

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [filter, setFilter] = useState('all');
  const [source, setSource] = useState('simple');
  const [message, setMessage] = useState('');
  const [aiErrorMessage, setAiErrorMessage] = useState(null);

  // Taste Analysis — a silent tool: compile once, then it powers recs + MILO chat.
  const [tasteProfile, setTasteProfile] = useState(null);
  const [tasteMeta, setTasteMeta] = useState(null); // { generatedAt, stale }
  const [tasteLoading, setTasteLoading] = useState(false);
  const [tasteError, setTasteError] = useState(null);

  // Feedback on rec cards — durable personalization layer (cloud-first for now).
  // Keyed `${contentType}:${normalizeTitle(title)}` → { feedback, addedId? }.
  const [feedbackMap, setFeedbackMap] = useState({});
  const [feedbackBusy, setFeedbackBusy] = useState(null);
  const { fetchMovies, deleteMovie } = useMovies();
  const { fetchSeries, deleteSeries } = useTVSeries();

  const contentLabel = contentType === 'tv' ? 'TV' : 'Movies';
  const accent = contentType === 'tv' ? 'magenta' : 'cyan';

  const loadModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const { models: list, error } = await movieApi.getOllamaModels();
      const safeList = list || [];
      setModels(safeList);
      if (error) {
        setModelsError(error);
      } else if (safeList.length > 0) {
        setSelectedModel((current) => current || pickBestModel(safeList));
      } else {
        setModelsError('No chat-capable models found. Run `ollama pull qwen2.5:7b` (or similar).');
      }
    } catch (e) {
      setModelsError(e.message || 'Failed to load models');
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    if (IS_CLOUD) return;
    if (hasStarted && models.length === 0 && !modelsLoading && !modelsError) {
      loadModels();
    }
  }, [hasStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!IS_CLOUD) return;
    const refresh = () => setCloudSettings(loadAISettings());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const fetchRecommendations = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const api = contentType === 'tv' ? tvApi : movieApi;
      const params = {
        type: filter === 'all' ? 'all' : filter,
        content: contentType,
        refresh: refresh.toString(),
      };
      const effectiveModel = IS_CLOUD ? cloudSettings?.model : selectedModel;
      if (effectiveModel) params.model = effectiveModel;
      const response = await api.getRecommendations(params);
      setRecommendations(response.recommendations || []);
      setSource(response.source || 'simple');
      setMessage(response.message || '');
      setAiErrorMessage(response.aiErrorMessage || null);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setSource('simple');
      setRecommendations([]);
      setMessage('');
      setAiErrorMessage(error.message || 'Request failed');
    } finally {
      if (refresh) setRefreshing(false); else setLoading(false);
    }
  };

  // Load any saved taste profile once the panel is opened.
  useEffect(() => {
    if (!hasStarted) return;
    let cancelled = false;
    tasteApi
      .getProfile()
      .then((res) => {
        if (cancelled) return;
        setTasteProfile(res.profile || null);
        setTasteMeta(res.profile ? { generatedAt: res.generatedAt, stale: !!res.stale } : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasStarted]);

  // Seed previously-given feedback so reappearing titles render marked.
  useEffect(() => {
    if (!IS_CLOUD || !hasStarted) return;
    let cancelled = false;
    feedbackApi
      .list({ content: contentType })
      .then((res) => {
        if (cancelled) return;
        const map = {};
        for (const row of res.feedback || []) {
          map[`${row.content_type}:${row.normalized_title}`] = { feedback: row.feedback };
        }
        setFeedbackMap(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasStarted, contentType]);

  const feedbackKeyFor = (rec) => `${rec.contentType || contentType}:${normalizeTitle(rec.title)}`;

  const handleFeedback = async (rec, verb) => {
    if (feedbackBusy) return;
    const ct = rec.contentType || contentType;
    const key = feedbackKeyFor(rec);
    const current = feedbackMap[key];
    setFeedbackBusy(key);
    try {
      // Undo the watchlist row we created this session when leaving 'interested'
      // (never touches a pre-existing watchlist entry).
      const removeAdded = async () => {
        if (current?.feedback === 'interested' && current.addedId) {
          if (ct === 'tv') await deleteSeries(current.addedId);
          else await deleteMovie(current.addedId);
        }
      };

      if (current?.feedback === verb) {
        await feedbackApi.remove({ title: rec.title, contentType: ct });
        await removeAdded();
        setFeedbackMap((m) => {
          const next = { ...m };
          delete next[key];
          return next;
        });
        return;
      }

      await feedbackApi.record({
        title: rec.title,
        contentType: ct,
        feedback: verb,
        year: rec.year ? Number(rec.year) || null : null,
        genre: rec.genre || null,
        recType: rec.type || null,
        model: (IS_CLOUD ? cloudSettings?.model : selectedModel) || null,
      });
      await removeAdded();

      let addedId = null;
      if (verb === 'interested') {
        try {
          const payload = {
            title: rec.title,
            genre: rec.genre || null,
            release_year: rec.year ? Number(rec.year) || null : null,
            status: 'to_watch',
          };
          const created = ct === 'tv' ? await tvApi.addSeries(payload) : await movieApi.addMovie(payload);
          addedId = created?.id ?? null;
          if (ct === 'tv') await fetchSeries();
          else await fetchMovies();
        } catch (e) {
          if (e?.status !== 409) throw e; // already in library — treat as success
        }
      }
      setFeedbackMap((m) => ({ ...m, [key]: { feedback: verb, addedId } }));
    } catch (e) {
      console.error('Feedback failed:', e);
    } finally {
      setFeedbackBusy(null);
    }
  };

  const handleAnalyze = async () => {
    setTasteLoading(true);
    setTasteError(null);
    try {
      const effectiveModel = IS_CLOUD ? cloudSettings?.model : selectedModel;
      const res = await tasteApi.generateProfile(effectiveModel || null);
      setTasteProfile(res.profile || null);
      setTasteMeta(res.profile ? { generatedAt: res.generatedAt, stale: false } : null);
    } catch (e) {
      setTasteError(e.message || 'Taste analysis failed');
    } finally {
      setTasteLoading(false);
    }
  };

  const handleStart = () => setHasStarted(true);

  const handleGenerate = () => {
    setHasGenerated(true);
    fetchRecommendations(false);
  };

  const handleRefresh = () => fetchRecommendations(true);

  const filteredRecommendations = recommendations.filter(rec => {
    if (filter === 'all') return true;
    return rec.type === filter;
  });

  const cloudReady = IS_CLOUD && cloudSettings && cloudSettings.model && (cloudSettings.provider === 'ollama' || !!getActiveKey(cloudSettings));
  const canGenerate = IS_CLOUD ? (cloudReady && !loading && !refreshing) : (!!selectedModel && !loading && !refreshing);
  const canAnalyze = (IS_CLOUD ? cloudReady : !!selectedModel) && !tasteLoading;

  if (!hasStarted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass rounded-2xl p-6 neon-border-${accent}`}
      >
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className={`text-${accent}`} size={24} />
          <h2 className={`text-xl font-bold neon-text-${accent}`}>
            Smart Recommendations
          </h2>
        </div>
        <div className="flex flex-col items-center text-center py-8 gap-4">
          <Sparkles size={48} className={`text-${accent} opacity-60`} />
          <p className="text-white/80 max-w-md leading-relaxed">
            Smart Recommendations analyses your personal watch history and uses a local AI model to find patterns in your ratings — then surfaces titles you're likely to love, from similar picks to hidden gems you might have missed.
          </p>
          <p className="text-white/40 text-sm">Pick a model, then hit Generate. Results are cached for 24 hours.</p>
          <button
            onClick={handleStart}
            className={`mt-2 flex items-center gap-2 px-6 py-3 rounded-xl bg-${accent}/20 border border-${accent}/40 hover:bg-${accent}/30 hover:border-${accent}/70 transition-all font-semibold text-white`}
          >
            <Sparkles size={18} />
            Get Recommendations
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-2xl p-6 neon-border-${accent}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sparkles className={`text-${accent}`} size={24} />
          <h2 className={`text-xl font-bold neon-text-${accent}`}>
            {contentLabel} Recommendations
          </h2>
        </div>
        {hasGenerated && (
          <button
            onClick={handleRefresh}
            disabled={refreshing || !canGenerate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`text-${accent} ${refreshing ? 'animate-spin' : ''}`} size={16} />
            <span className="text-white/70 text-sm">Refresh</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Filter size={16} className="text-white/50" />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-black/30 text-white rounded-lg px-3 py-1.5 text-sm border border-white/10 focus:border-white/30 outline-none"
        >
          <option value="all">All Recommendations</option>
          <option value="similar">Similar to Favorites</option>
          <option value="hidden_gems">Hidden Gems</option>
        </select>
        {IS_CLOUD ? (
          <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 text-sm border border-white/10">
            <SettingsIcon size={14} className="text-white/50" />
            <span className="text-white/70">
              {cloudSettings?.provider || 'no provider'} · {cloudSettings?.model || 'no model'}
            </span>
          </div>
        ) : (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={modelsLoading || models.length === 0}
            className="bg-black/30 text-white rounded-lg px-3 py-1.5 text-sm border border-white/10 focus:border-white/30 outline-none disabled:opacity-50"
          >
            {modelsLoading && <option value="">Loading models…</option>}
            {!modelsLoading && models.length === 0 && <option value="">No models available</option>}
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg bg-${accent}/20 border border-${accent}/40 hover:bg-${accent}/30 hover:border-${accent}/70 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white text-sm font-semibold`}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {hasGenerated ? 'Generate Again' : 'Generate'}
        </button>
      </div>

      <div className="mb-4 px-3 py-2.5 rounded-lg bg-black/20 border border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Brain size={16} className={`text-${accent} shrink-0`} />
            <div className="min-w-0">
              <p className="text-white/80 text-sm font-medium">Taste Analysis</p>
              {tasteLoading ? (
                <p className="text-white/40 text-xs">Compiling your taste profile…</p>
              ) : tasteProfile ? (
                <p className="text-white/40 text-xs truncate">
                  Profile ready{tasteMeta?.generatedAt ? ` · ${formatWhen(tasteMeta.generatedAt)}` : ''}
                  {tasteMeta?.stale ? ' · library changed — consider re-analyzing' : ''}
                </p>
              ) : (
                <p className="text-white/40 text-xs">Compile a read of your taste to sharpen recs & MILO chat.</p>
              )}
            </div>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-${accent}/15 border border-${accent}/30 hover:bg-${accent}/25 hover:border-${accent}/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white text-xs font-semibold shrink-0`}
          >
            {tasteLoading ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
            {tasteProfile ? 'Re-analyze' : 'Analyze my taste'}
          </button>
        </div>
        {tasteProfile?.persona && !tasteLoading && (
          <p className="text-white/50 text-xs mt-2 leading-relaxed">{tasteProfile.persona}</p>
        )}
        {tasteError && (
          <p className="text-red-400 text-xs mt-2 font-mono break-all">{tasteError}</p>
        )}
      </div>

      {IS_CLOUD && !cloudReady && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <AlertCircle size={14} className="text-yellow-300 shrink-0 mt-0.5" />
          <span className="text-yellow-200 text-sm">
            Open <strong>Settings</strong> (top-right gear) and add an API key + pick a model to enable recommendations.
          </span>
        </div>
      )}

      {modelsError && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2 bg-red-500/10 rounded-lg border border-red-500/20">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-red-400 text-sm font-mono">{modelsError}</span>
          </div>
          <button
            onClick={loadModels}
            disabled={modelsLoading}
            className="text-red-300 text-xs underline hover:text-red-200 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {!hasGenerated && !modelsError && (
        <div className="text-center py-8 text-white/50">
          <Sparkles className={`mx-auto mb-2 text-${accent} opacity-60`} size={32} />
          <p>Choose a model and hit Generate to get personalized recommendations.</p>
        </div>
      )}

      {hasGenerated && loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-white/50" size={32} />
          <p className="ml-3 text-white/50">Loading recommendations…</p>
        </div>
      )}

      {hasGenerated && !loading && (
        <>
          {source === 'ai' && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-500/10 rounded-lg border border-green-500/20">
              <Sparkles size={14} className="text-green-400" />
              <span className="text-green-400 text-sm">AI-Powered</span>
              {tasteProfile && (
                <span className="text-green-300/60 text-xs ml-1">· Powered by your Taste Profile</span>
              )}
            </div>
          )}

          {message && (
            <p className="text-white/60 text-sm mb-4">{message}</p>
          )}

          {aiErrorMessage && source === 'simple' && (
            <div className="flex items-start gap-2 mb-4 px-3 py-2 bg-red-500/10 rounded-lg border border-red-500/20">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <span className="text-red-400 text-sm font-mono break-all">{aiErrorMessage}</span>
            </div>
          )}

          <AnimatePresence>
            {filteredRecommendations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <AlertCircle className="mx-auto mb-2 text-white/30" size={32} />
                <p className="text-white/50">No recommendations yet</p>
                <p className="text-white/30 text-sm">Add more {contentLabel.toLowerCase()} to get personalized suggestions</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {filteredRecommendations.map((rec, index) => {
                  const fbKey = feedbackKeyFor(rec);
                  const fbActive = feedbackMap[fbKey]?.feedback;
                  const fbBusy = feedbackBusy === fbKey;
                  const fbBtnBase = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed';
                  const fbBtnIdle = 'bg-black/20 border-white/10 text-white/60 hover:border-white/30 hover:text-white';
                  return (
                  <motion.div
                    key={`${rec.type}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-black/20 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all ${fbActive === 'not_for_me' ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-white">{rec.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {rec.year && <span className="text-white/50 text-sm">{rec.year}</span>}
                          {rec.genre && (
                            <>
                              <span className="text-white/30">•</span>
                              <span className={`text-${contentType === 'tv' ? 'neon-magenta' : 'neon-cyan'} text-sm`}>{rec.genre}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${rec.confidence * 10}%` }}
                            className={`h-full bg-gradient-to-r from-${contentType === 'tv' ? 'magenta' : 'cyan'}-500 to-purple-500`}
                          />
                        </div>
                        <span className="text-white/50 text-xs ml-1">{rec.confidence}/10</span>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm leading-relaxed">{rec.explanation}</p>
                    {IS_CLOUD && source === 'ai' && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <button
                          onClick={() => handleFeedback(rec, 'interested')}
                          disabled={fbBusy}
                          className={`${fbBtnBase} ${fbActive === 'interested' ? `bg-${accent}/20 border-${accent}/40 text-white` : fbBtnIdle}`}
                        >
                          <ThumbsUp size={12} />
                          {fbActive === 'interested' ? 'Added to watchlist' : 'Interested'}
                        </button>
                        <button
                          onClick={() => handleFeedback(rec, 'not_for_me')}
                          disabled={fbBusy}
                          className={`${fbBtnBase} ${fbActive === 'not_for_me' ? 'bg-red-500/20 border-red-500/50 text-red-300' : fbBtnIdle}`}
                        >
                          <ThumbsDown size={12} />
                          Not for me
                        </button>
                        <button
                          onClick={() => handleFeedback(rec, 'seen_it')}
                          disabled={fbBusy}
                          className={`${fbBtnBase} ${fbActive === 'seen_it' ? 'bg-white/15 border-white/40 text-white' : fbBtnIdle}`}
                        >
                          <EyeOff size={12} />
                          Seen it
                        </button>
                      </div>
                    )}
                    {rec.cached && (
                      <div className="mt-2">
                        <span className="text-xs text-white/40">From cache</span>
                      </div>
                    )}
                  </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
