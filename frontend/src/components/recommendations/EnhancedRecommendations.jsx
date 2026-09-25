import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, Filter, Loader2, AlertCircle, Play, Settings as SettingsIcon, Brain, ThumbsUp, ThumbsDown, EyeOff, HelpCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { api as movieApi } from '../../api/movieApi';
import { tvApi } from '../../api/tvApi';
import { api as tasteApi } from '../../api/tasteApi';
import { api as feedbackApi } from '../../api/feedbackApi';
import { normalizeTitle } from '../../ai/prompt';
import { useMovies } from '../../utils/MovieContext';
import { useTVSeries } from '../../utils/TVSeriesContext';
import { usePodcasts } from '../../utils/PodcastContext';
import { useBooks } from '../../utils/BookContext';
import { IS_CLOUD } from '../../utils/mode';
import { loadAISettings, getActiveKey } from '../../utils/aiSettings';
import { PRESETS } from '../../recommendations/presets';
import { getContentType, accentFor } from '../../utils/contentTypes';
import { podcastApi } from '../../api/podcastApi';
import { bookApi } from '../../api/bookApi';
import { lookupRecArtwork } from '../../api/artworkLookup';
import CoverArt from '../shared/CoverArt';
import AddMovieModal from '../movies/AddMovieModal';
import AddTVSeriesModal from '../tv/AddTVSeriesModal';
import AddPodcastModal from '../podcasts/AddPodcastModal';
import AddBookModal from '../books/AddBookModal';
import AIProvidersHelpModal from '../settings/AIProvidersHelpModal';

// Per-content-type wiring. These replace the `contentType === 'tv' ? … : …`
// ternaries that used to run through this file, which silently treated any
// third type as a movie.
const API_BY_TYPE = { movie: movieApi, tv: tvApi, podcast: podcastApi, book: bookApi };
const ADD_BY_TYPE = {
  movie: (payload) => movieApi.addMovie(payload),
  tv: (payload) => tvApi.addSeries(payload),
  podcast: (payload) => podcastApi.addPodcast(payload),
  book: (payload) => bookApi.addBook(payload),
};
const SEEN_IT_MODALS = { movie: AddMovieModal, tv: AddTVSeriesModal, podcast: AddPodcastModal, book: AddBookModal };

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
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [cloudSettings, setCloudSettings] = useState(() => (IS_CLOUD ? loadAISettings() : null));

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [filter, setFilter] = useState('all');
  // Quick Hitters — a selected preset id replaces the similar/hidden_gems type
  // and travels to the API as the `type` value. null = plain type-based mode.
  const [activePreset, setActivePreset] = useState(null);
  // Label of the preset used in the last generation (for the results banner).
  const [generatedPresetLabel, setGeneratedPresetLabel] = useState(null);
  const [source, setSource] = useState('simple');
  const [message, setMessage] = useState('');
  const [aiErrorMessage, setAiErrorMessage] = useState(null);

  // Taste Analysis — a silent tool: compile once, then it powers recs + MILO chat.
  const [tasteProfile, setTasteProfile] = useState(null);
  const [tasteMeta, setTasteMeta] = useState(null); // { generatedAt, stale }
  const [tasteLoading, setTasteLoading] = useState(false);
  const [tasteError, setTasteError] = useState(null);
  // Living taste memory: the profile silently refreshes inside the Generate
  // flow when the library/feedback has changed enough (cloud only).
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  // Feedback on rec cards — durable personalization layer (cloud-first for now).
  // Keyed `${contentType}:${normalizeTitle(title)}` → { feedback, addedId? }.
  const [feedbackMap, setFeedbackMap] = useState({});
  const [feedbackBusy, setFeedbackBusy] = useState(null);
  // A rec the user marked "Seen it" — opens a prefilled Add modal to log it as watched.
  const [seenItRec, setSeenItRec] = useState(null);
  // Posters / cover art found for the current recs, keyed like feedbackMap.
  // Filled in after the cards render; a rec with no match keeps CoverArt's tile.
  const [artByKey, setArtByKey] = useState({});
  // Bumped per fetch (and on unmount) so late lookups from an older run are dropped.
  const artRunRef = useRef(0);
  useEffect(() => () => { artRunRef.current += 1; }, []);
  const { fetchMovies, deleteMovie } = useMovies();
  const { fetchSeries, deleteSeries } = useTVSeries();
  const { fetchPodcasts, deletePodcast } = usePodcasts();
  const { fetchBooks, deleteBook } = useBooks();

  // Context-bound counterparts to the module-level maps above.
  const REMOVE_BY_TYPE = { movie: deleteMovie, tv: deleteSeries, podcast: deletePodcast, book: deleteBook };
  const REFRESH_BY_TYPE = { movie: fetchMovies, tv: fetchSeries, podcast: fetchPodcasts, book: fetchBooks };

  const contentLabel = getContentType(contentType).nav;
  const A = accentFor(contentType);
  // Quick Hitters are scoped per content type (movies/TV keep viewing moods,
  // podcasts get listening genres, books get reading moods) — only render the
  // chips that apply here.
  const visiblePresets = PRESETS.filter((p) => p.contentTypes.includes(contentType));

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
      const api = API_BY_TYPE[contentType] || API_BY_TYPE.movie;
      const params = {
        type: activePreset ?? (filter === 'all' ? 'all' : filter),
        content: contentType,
        refresh: refresh.toString(),
      };
      const effectiveModel = IS_CLOUD ? cloudSettings?.model : selectedModel;
      if (effectiveModel) params.model = effectiveModel;
      const response = await api.getRecommendations(params);
      setGeneratedPresetLabel(activePreset ? (PRESETS.find((p) => p.id === activePreset)?.label || null) : null);
      const recs = response.recommendations || [];
      setRecommendations(recs);
      loadArtwork(recs);
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

  const loadArtwork = (recs) => {
    const run = ++artRunRef.current;
    setArtByKey({});
    for (const rec of recs) {
      lookupRecArtwork(rec, rec.contentType || contentType).then((art) => {
        if (!art || artRunRef.current !== run) return;
        setArtByKey((m) => ({ ...m, [feedbackKeyFor(rec)]: art }));
      });
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
          await REMOVE_BY_TYPE[ct]?.(current.addedId);
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
        // Wildcard reactions are tagged so taste analysis can learn the user's
        // exploration appetite; the underlying rec type rides after the colon.
        recType: rec.wildcard ? `wildcard:${rec.type || ''}` : (rec.type || null),
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
            artwork_url: artByKey[key]?.artwork_url || null,
            status: 'to_watch',
          };
          const created = await ADD_BY_TYPE[ct](payload);
          addedId = created?.id ?? null;
          await REFRESH_BY_TYPE[ct]();
        } catch (e) {
          if (e?.status !== 409) throw e; // already in library — treat as success
        }
      }
      setFeedbackMap((m) => ({ ...m, [key]: { feedback: verb, addedId } }));

      // "Seen it" → offer to log it in the watched library (rating required, so
      // open the prefilled Add modal). Feedback is already recorded above, so the
      // AI stops recommending it whether or not the user completes the modal.
      if (verb === 'seen_it') setSeenItRec(rec);
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

  const handleGenerate = async () => {
    setHasGenerated(true);
    // Enter the loading state immediately so the spinner covers the whole flow —
    // including the awaited taste auto-refresh below — instead of flashing the
    // empty state ("No recommendations yet") while it runs.
    setLoading(true);
    // Refresh the taste profile first (when warranted) so the rec call that
    // follows reads the fresh one. Never blocks recs — failures fall through.
    if (IS_CLOUD && cloudReady && tasteProfile) {
      setAutoRefreshing(true);
      try {
        const r = await tasteApi.maybeRefreshProfile({ model: cloudSettings?.model || null });
        if (r?.refreshed) {
          setTasteProfile(r.profile || null);
          setTasteMeta({ generatedAt: r.generatedAt, stale: false });
        }
      } catch { /* never block recs */ } finally {
        setAutoRefreshing(false);
      }
    }
    fetchRecommendations(false);
  };

  const handleRefresh = () => fetchRecommendations(true);

  // Clicking a chip selects it (or clears it if already active). Selection only —
  // the user still hits Generate. Reset the filter so preset cards (whose rec.type
  // is the preset id) aren't hidden by a stale similar/hidden_gems filter.
  const togglePreset = (id) =>
    setActivePreset((cur) => {
      const next = cur === id ? null : id;
      if (next) setFilter('all');
      return next;
    });

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
        className={`glass rounded-2xl p-6 ${A.border}`}
      >
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className={A.text} size={24} />
          <h2 className={`text-xl font-bold ${A.glow} ${A.text}`}>
            Smart Recommendations
          </h2>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="shrink-0 p-1.5 rounded-lg text-white/50 hover:text-neon-cyan hover:bg-white/5 transition-colors"
            title="How AI providers work"
            aria-label="How AI providers work"
          >
            <HelpCircle size={18} />
          </button>
        </div>
        <div className="flex flex-col items-center text-center py-8 gap-4">
          <Sparkles size={48} className={`${A.text} opacity-60`} />
          <p className="text-white/80 max-w-md leading-relaxed">
            Smart Recommendations analyses your personal watch history and uses a local AI model to find patterns in your ratings — then surfaces titles you're likely to love, from similar picks to hidden gems you might have missed.
          </p>
          <p className="text-white/40 text-sm">Pick a model, then hit Generate. Results are cached for 24 hours.</p>
          <button
            onClick={handleStart}
            className={`mt-2 flex items-center gap-2 px-6 py-3 rounded-xl border transition-all font-semibold text-white ${A.btnPrimary}`}
          >
            <Sparkles size={18} />
            Get Recommendations
          </button>
        </div>
        <AIProvidersHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-2xl p-6 ${A.border}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sparkles className={A.text} size={24} />
          <h2 className={`text-xl font-bold ${A.glow} ${A.text}`}>
            {contentLabel} Recommendations
          </h2>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="shrink-0 p-1.5 rounded-lg text-white/50 hover:text-neon-cyan hover:bg-white/5 transition-colors"
            title="How AI providers work"
            aria-label="How AI providers work"
          >
            <HelpCircle size={18} />
          </button>
        </div>
        {hasGenerated && (
          <button
            onClick={handleRefresh}
            disabled={refreshing || !canGenerate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`${A.text} ${refreshing ? 'animate-spin' : ''}`} size={16} />
            <span className="text-white/70 text-sm">Refresh</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {visiblePresets.map((p) => {
          const active = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePreset(p.id)}
              title={p.directive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                active
                  ? `${A.chipActive} text-white`
                  : 'bg-black/20 border-white/10 text-white/60 hover:border-white/30 hover:text-white'
              }`}
            >
              <span>{p.emoji}</span>
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Filter size={16} className="text-white/50" />
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setActivePreset(null); }}
          disabled={!!activePreset}
          className="bg-black/30 text-white rounded-lg px-3 py-1.5 text-sm border border-white/10 focus:border-white/30 outline-none disabled:opacity-50"
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
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white text-sm font-semibold ${A.btnPrimary}`}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {hasGenerated ? 'Generate Again' : 'Generate'}
        </button>
      </div>

      <div className="mb-4 px-3 py-2.5 rounded-lg bg-black/20 border border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Brain size={16} className={`${A.text} shrink-0`} />
            <div className="min-w-0">
              <p className="text-white/80 text-sm font-medium">Taste Analysis</p>
              {tasteLoading || autoRefreshing ? (
                <p className="text-white/40 text-xs">
                  {autoRefreshing ? 'MILO is updating its read of your taste…' : 'Compiling your taste profile…'}
                </p>
              ) : tasteProfile ? (
                <p className="text-white/40 text-xs truncate">
                  Profile ready{tasteMeta?.generatedAt ? ` · ${formatWhen(tasteMeta.generatedAt)}` : ''}
                  {tasteMeta?.stale
                    ? IS_CLOUD
                      ? ' · library changed — MILO will refresh on your next Generate'
                      : ' · library changed — consider re-analyzing'
                    : ''}
                </p>
              ) : (
                <p className="text-white/40 text-xs">Compile a read of your taste to sharpen recs & MILO chat.</p>
              )}
            </div>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white text-xs font-semibold shrink-0 ${A.btnSmall}`}
          >
            {tasteLoading ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
            {tasteProfile ? 'Re-analyze' : 'Analyze my taste'}
          </button>
        </div>
        {tasteProfile?.persona && !tasteLoading && (
          <p className="text-white/50 text-xs mt-2 leading-relaxed">{tasteProfile.persona}</p>
        )}
        {tasteProfile?.recentShift && !tasteLoading && (
          <p className="text-white/50 text-xs mt-1 leading-relaxed">
            <span className={`${A.text} font-medium`}>MILO noticed:</span> {tasteProfile.recentShift}
          </p>
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
          <Sparkles className={`mx-auto mb-2 ${A.text} opacity-60`} size={32} />
          <p>Choose a model and hit Generate to get personalized recommendations.</p>
        </div>
      )}

      {hasGenerated && (loading || autoRefreshing) && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-white/50" size={32} />
          <p className="ml-3 text-white/50">Loading recommendations…</p>
        </div>
      )}

      {hasGenerated && !loading && !autoRefreshing && (
        <>
          {source === 'ai' && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-500/10 rounded-lg border border-green-500/20">
              <Sparkles size={14} className="text-green-400" />
              <span className="text-green-400 text-sm">AI-Powered</span>
              {generatedPresetLabel && (
                <span className="text-green-300/80 text-xs ml-1">· {generatedPresetLabel}</span>
              )}
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
                  const art = artByKey[fbKey];
                  const year = rec.year || art?.year;
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
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <CoverArt contentType={rec.contentType || contentType} src={art?.artwork_url} title={rec.title} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white">{rec.title}</h3>
                            {rec.wildcard && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300"
                                title="A deliberate stretch pick — one step outside your usual taste"
                              >
                                🎲 Wildcard
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {year && <span className="text-white/50 text-sm">{year}</span>}
                            {rec.genre && (
                              <>
                                {year && <span className="text-white/30">•</span>}
                                <span className={`${A.text} text-sm`}>{rec.genre}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${rec.confidence * 10}%` }}
                            className={`h-full bg-gradient-to-r ${A.barGrad}`}
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
                          className={`${fbBtnBase} ${fbActive === 'interested' ? `${A.fbActive} text-white` : fbBtnIdle}`}
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

      {seenItRec && (() => {
        const SeenItModal = SEEN_IT_MODALS[contentType] || SEEN_IT_MODALS.movie;
        return (
          <SeenItModal
            key={seenItRec.title}
            isOpen={true}
            onClose={() => setSeenItRec(null)}
            prefill={{
              title: seenItRec.title,
              genre: seenItRec.genre || '',
              release_year: seenItRec.year ? String(seenItRec.year) : (artByKey[feedbackKeyFor(seenItRec)]?.year || ''),
              artwork_url: artByKey[feedbackKeyFor(seenItRec)]?.artwork_url || '',
              status: 'watched',
            }}
          />
        );
      })()}
      <AIProvidersHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </motion.div>
  );
}
