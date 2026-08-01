import { getSupabase } from '../utils/supabase';
import {
  generateRecommendations as aiGenerate,
  listModels as aiListModels,
  generateTasteProfile as aiGenerateTasteProfile,
} from '../ai';
import { normalizeTitle, hashLibrary, compactProfileSnapshot } from '../ai/prompt';
import { loadAISettings } from '../utils/aiSettings';
import { parseLetterboxdCSV, processLetterboxdRows } from './letterboxdClient';
import { parseMiloDb, processDbRows } from './dbClient';

const TABLE = 'movies';

// Anti-repetition: remember titles recently shown per contentType:recType so
// regenerations return fresh picks. Bounded to the last ~30 per key.
const recentlyRecommended = new Map();
const RECENT_LIMIT = 30;
function rememberRecs(key, titles) {
  const prev = recentlyRecommended.get(key) || [];
  const merged = [...titles, ...prev].filter(Boolean);
  const deduped = [...new Set(merged)].slice(0, RECENT_LIMIT);
  recentlyRecommended.set(key, deduped);
}

function normalizeDateFields(row) {
  const out = { ...row };
  if (out.date_watched === '') out.date_watched = null;
  return out;
}

async function requireUserId() {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) throw new Error('Not signed in.');
  return data.user.id;
}

const TASTE_TABLE = 'taste_profiles';

// Signature over the whole watched library (movies + TV) — including
// rating/status edits, not just adds/removes. Mirrors backend/taste-analyzer.js
// profileSignature so staleness is computed the same way.
function profileSignature(movies = [], tvSeries = []) {
  const all = [...movies, ...tvSeries];
  if (all.length === 0) return '0:';
  return `${all.length}:${hashLibrary(all)}`;
}

// Auto-refresh thresholds: the taste profile is regenerated (one extra AI call,
// only inside the Generate flow) once the library or feedback has changed
// enough to matter. First-ever profile creation stays manual.
const AUTO_REFRESH_MIN_COUNT_DELTA = 5;
const AUTO_REFRESH_MIN_NEW_FEEDBACK = 5;
const AUTO_REFRESH_MAX_AGE_DAYS = 14;
// One auto-refresh attempt per library-state per session — set before the AI
// call so a failing key doesn't burn a taste-analysis call on every Generate.
let autoRefreshTriedFor = null;

function shouldAutoRefreshProfile({ row, movies, tvSeries, feedbackRows, now = Date.now() }) {
  if (!row?.profile_json || !row.generated_at) return { refresh: false, reason: null };
  const currentSig = profileSignature(movies, tvSeries);
  const stale = row.library_signature !== currentSig;
  // The signature format is `${count}:${hash}` — parseInt reads the count prefix.
  const priorCount = parseInt(row.library_signature, 10) || 0;
  const countDelta = Math.abs(movies.length + tvSeries.length - priorCount);
  const generatedAtMs = Date.parse(row.generated_at) || 0;
  const newFeedback = (feedbackRows || []).filter(
    (r) => (Date.parse(r.created_at || r.updated_at) || 0) > generatedAtMs
  ).length;
  const ageDays = (now - generatedAtMs) / 86400000;
  if (stale && countDelta >= AUTO_REFRESH_MIN_COUNT_DELTA) return { refresh: true, reason: 'library-growth' };
  // Feedback never changes the library signature, so it needs its own trigger.
  if (newFeedback >= AUTO_REFRESH_MIN_NEW_FEEDBACK) return { refresh: true, reason: 'feedback' };
  if (stale && ageDays >= AUTO_REFRESH_MAX_AGE_DAYS) return { refresh: true, reason: 'age' };
  return { refresh: false, reason: null };
}

const FEEDBACK_TABLE = 'rec_feedback';

// Group feedback rows (most recent first) into capped title lists for prompts.
function groupFeedback(rows) {
  const grouped = { interested: [], notForMe: [], seenIt: [] };
  const caps = { interested: 25, notForMe: 40, seenIt: 40 };
  const keyFor = { interested: 'interested', not_for_me: 'notForMe', seen_it: 'seenIt' };
  for (const row of rows || []) {
    const key = keyFor[row.feedback];
    if (key && grouped[key].length < caps[key]) grouped[key].push(row.title);
  }
  return grouped;
}

async function listFeedbackRows(contentType = null) {
  const sb = getSupabase();
  const user_id = await requireUserId();
  let q = sb.from(FEEDBACK_TABLE).select('*').eq('user_id', user_id).order('updated_at', { ascending: false });
  if (contentType && contentType !== 'all') q = q.eq('content_type', contentType);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

// Load the saved taste profile object (or null) — used to enrich recs + assistant.
async function loadSavedTasteProfile() {
  try {
    const sb = getSupabase();
    const user_id = await requireUserId();
    const { data } = await sb
      .from(TASTE_TABLE)
      .select('profile_json')
      .eq('user_id', user_id)
      .eq('scope', 'all')
      .maybeSingle();
    return data?.profile_json || null;
  } catch {
    return null;
  }
}

function applyFilters(query, params) {
  const { search, genre, minRating, maxRating, startDate, endDate, type, status } = params;
  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);
  if (genre) query = query.eq('genre', genre);
  if (minRating !== undefined && minRating !== null && minRating !== '') query = query.gte('rating', Number(minRating));
  if (maxRating !== undefined && maxRating !== null && maxRating !== '') query = query.lte('rating', Number(maxRating));
  if (startDate) query = query.gte('date_watched', startDate);
  if (endDate) query = query.lte('date_watched', endDate);
  if (search) query = query.or(`title.ilike.%${search}%,notes.ilike.%${search}%`);
  return query;
}

function applySort(query, sortBy) {
  switch (sortBy) {
    case 'highest_rated':
      return query.order('rating', { ascending: false, nullsFirst: false }).order('date_watched', { ascending: false, nullsFirst: false });
    case 'lowest_rated':
      return query.order('rating', { ascending: true, nullsFirst: false }).order('date_watched', { ascending: false, nullsFirst: false });
    case 'title_asc':
      return query.order('title', { ascending: true });
    case 'title_desc':
      return query.order('title', { ascending: false });
    case 'most_recent':
    default:
      return query.order('date_watched', { ascending: false, nullsFirst: false });
  }
}

async function listRows(params = {}) {
  const sb = getSupabase();
  const user_id = await requireUserId();
  let q = sb.from(TABLE).select('*').eq('user_id', user_id);
  q = applyFilters(q, params);
  q = applySort(q, params.sortBy);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

function computeAnalytics(rows, contentType) {
  const total = rows.length;
  const ratings = rows.map((r) => r.rating).filter((r) => typeof r === 'number');
  const avgRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : 0;

  const genreCounts = {};
  rows.forEach((r) => {
    if (r.genre) genreCounts[r.genre] = (genreCounts[r.genre] || 0) + 1;
  });
  const genreData = Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
  const topGenres = genreData.slice(0, 5);

  const timelineMap = {};
  rows.forEach((r) => {
    if (r.date_watched) timelineMap[r.date_watched] = (timelineMap[r.date_watched] || 0) + 1;
  });
  const timeline = Object.entries(timelineMap)
    .map(([date_watched, count]) => ({ date_watched, count }))
    .sort((a, b) => (a.date_watched < b.date_watched ? 1 : -1));

  const recommendations = topGenres[0]
    ? {
        favoriteGenre: topGenres[0].genre,
        suggestions: `Explore more ${topGenres[0].genre} — your favorite so far.`,
        message: `Based on your love for ${topGenres[0].genre} ${contentType === 'tv' ? 'TV series' : 'movies'}:`,
      }
    : { message: `Add more ${contentType === 'tv' ? 'TV series' : 'movies'} to get personalized recommendations!` };

  return { total, avgRating, topGenres, timeline, recommendations };
}

export const movieApi = {
  async getMovies(params = {}) {
    return listRows({ ...params, type: params.type || 'movie' });
  },

  async addMovie(movie) {
    const sb = getSupabase();
    const user_id = await requireUserId();
    const resolvedType = movie.type || 'movie';
    const resolvedStatus = movie.status || 'watched';

    const { data: existing } = await sb
      .from(TABLE)
      .select('id, status')
      .eq('user_id', user_id)
      .eq('type', resolvedType)
      .eq('title', movie.title)
      .limit(1)
      .maybeSingle();

    if (existing && existing.status !== resolvedStatus) {
      const err = new Error('Title already exists with a different status');
      err.status = 409;
      err.data = { existingId: existing.id, currentStatus: existing.status, requestedStatus: resolvedStatus };
      throw err;
    }

    const payload = normalizeDateFields({ ...movie, type: resolvedType, status: resolvedStatus, user_id });
    const { data, error } = await sb.from(TABLE).insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateMovie(id, movie) {
    const sb = getSupabase();
    const payload = normalizeDateFields({ ...movie, type: movie.type || 'movie' });
    delete payload.id;
    delete payload.user_id;
    delete payload.created_at;
    const { data, error } = await sb.from(TABLE).update(payload).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteMovie(id) {
    const sb = getSupabase();
    const { error } = await sb.from(TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { message: 'Movie deleted successfully' };
  },

  async getAnalytics(params = {}) {
    const rows = await listRows({ type: params.type, status: 'watched' });
    return computeAnalytics(rows, params.type || 'movie');
  },

  async getRecommendations(params = {}) {
    const { type = 'all', content = 'movie', model, refresh } = params;
    const settings = loadAISettings();
    if (model) settings.model = model;
    // On refresh, sample the digest/grounding so regenerations draw from
    // different corners of the library; first generation stays deterministic.
    const sample = refresh === true || refresh === 'true';

    const contentTypes = content === 'all' ? ['movie', 'tv'] : [content];
    const recTypes = type === 'all' ? ['similar', 'hidden_gems'] : [type];

    const rowsByType = {};
    for (const ct of contentTypes) rowsByType[ct] = await listRows({ type: ct, status: 'watched' });

    const tasteProfile = await loadSavedTasteProfile();

    let feedbackRows = [];
    try {
      feedbackRows = await listFeedbackRows();
    } catch (e) {
      console.error('Failed to load rec feedback:', e.message);
    }

    const allRecs = [];
    let lastError = null;
    for (const recType of recTypes) {
      for (const ct of contentTypes) {
        try {
          const recentKey = `${ct}:${recType}`;
          const feedback = groupFeedback(feedbackRows.filter((r) => r.content_type === ct));
          const recs = await aiGenerate({
            userMovies: rowsByType[ct],
            type: recType,
            contentType: ct,
            extraExclusions: recentlyRecommended.get(recentKey) || [],
            tasteProfile,
            feedback,
            sample,
            settings,
          });
          const watchedSet = new Set(rowsByType[ct].map((r) => normalizeTitle(r.title)));
          // Hard-filter feedback titles too — the model may ignore instructions.
          const feedbackSet = new Set(
            [...feedback.interested, ...feedback.notForMe, ...feedback.seenIt].map(normalizeTitle)
          );
          const filtered = recs.filter((r) => !watchedSet.has(normalizeTitle(r.title)) && !feedbackSet.has(normalizeTitle(r.title)));
          rememberRecs(recentKey, filtered.map((r) => r.title));
          filtered.forEach((r) => allRecs.push({ ...r, type: recType, contentType: ct, cached: false }));
        } catch (e) {
          lastError = e;
          console.error(`AI failed for ${ct}/${recType}:`, e.message);
        }
      }
    }

    if (allRecs.length) {
      return {
        recommendations: allRecs,
        source: 'ai',
        message: 'AI-powered recommendations based on your viewing history',
      };
    }
    return {
      recommendations: [],
      source: 'simple',
      message: lastError ? 'AI recommendations failed — see details below.' : 'No recommendations yet.',
      aiErrorMessage: lastError ? lastError.message : null,
    };
  },

  async getOllamaModels() {
    try {
      const settings = loadAISettings();
      const models = await aiListModels({ ...settings, provider: 'ollama' });
      return { models };
    } catch (e) {
      return { models: [], error: e.message };
    }
  },

  async previewLetterboxd(file) {
    const sb = getSupabase();
    const user_id = await requireUserId();
    const rows = await parseLetterboxdCSV(file);
    const { data: existing } = await sb.from(TABLE).select('title').eq('type', 'movie').eq('user_id', user_id);
    const existingTitles = new Set((existing || []).map((m) => m.title));
    return processLetterboxdRows(rows, existingTitles);
  },

  async importLetterboxd(file) {
    const sb = getSupabase();
    const user_id = await requireUserId();
    const rows = await parseLetterboxdCSV(file);
    const { data: existing } = await sb.from(TABLE).select('title').eq('type', 'movie').eq('user_id', user_id);
    const existingTitles = new Set((existing || []).map((m) => m.title));
    const result = processLetterboxdRows(rows, existingTitles);
    if (result.toImport > 0) {
      const insertRows = result.allMovies.map((m) => ({ ...m, user_id }));
      const { error } = await sb.from(TABLE).insert(insertRows);
      if (error) throw new Error(error.message);
    }
    return { ...result, imported: result.toImport };
  },

  async previewDb(file) {
    const sb = getSupabase();
    const user_id = await requireUserId();
    const rows = await parseMiloDb(file);
    const { data: existing } = await sb.from(TABLE).select('title, type').eq('user_id', user_id);
    const existingKeys = new Set((existing || []).map((m) => `${m.title} ${m.type === 'tv' ? 'tv' : 'movie'}`));
    return processDbRows(rows, existingKeys);
  },

  async importDb(file) {
    const sb = getSupabase();
    const user_id = await requireUserId();
    const rows = await parseMiloDb(file);
    const { data: existing } = await sb.from(TABLE).select('title, type').eq('user_id', user_id);
    const existingKeys = new Set((existing || []).map((m) => `${m.title} ${m.type === 'tv' ? 'tv' : 'movie'}`));
    const result = processDbRows(rows, existingKeys);
    if (result.toImport > 0) {
      const insertRows = result.allMovies.map((m) => ({ ...m, user_id }));
      const { error } = await sb.from(TABLE).insert(insertRows);
      if (error) throw new Error(error.message);
    }
    return { ...result, imported: result.toImport };
  },
};

export const tvApi = {
  getSeries: (params = {}) => listRows({ ...params, type: 'tv' }),
  addSeries: (series) => movieApi.addMovie({ ...series, type: 'tv' }),
  updateSeries: (id, series) => movieApi.updateMovie(id, { ...series, type: 'tv' }),
  deleteSeries: (id) => movieApi.deleteMovie(id),
  getAnalytics: async () => {
    const rows = await listRows({ type: 'tv' });
    return computeAnalytics(rows, 'tv');
  },
  getRecommendations: (params = {}) => movieApi.getRecommendations({ ...params, content: 'tv' }),
};

export const assistantApi = {
  async chatWithAssistant(message, model = null, movies = [], tvSeries = [], analytics = null, history = []) {
    const { chatAssistant } = await import('../ai');
    const settings = loadAISettings();
    if (model) settings.model = model;
    const tasteProfile = await loadSavedTasteProfile();
    return chatAssistant({ message, movies, tvSeries, analytics, history, tasteProfile, settings });
  },
  async getOllamaModels() {
    return movieApi.getOllamaModels();
  },
};

export const tasteApi = {
  async getProfile() {
    const sb = getSupabase();
    const user_id = await requireUserId();
    const { data, error } = await sb
      .from(TASTE_TABLE)
      .select('*')
      .eq('user_id', user_id)
      .eq('scope', 'all')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { profile: null };

    const [movies, tvSeries] = await Promise.all([
      listRows({ type: 'movie', status: 'watched' }),
      listRows({ type: 'tv', status: 'watched' }),
    ]);
    const currentSignature = profileSignature(movies, tvSeries);
    return {
      profile: data.profile_json || null,
      model: data.model,
      generatedAt: data.generated_at,
      signature: data.library_signature,
      stale: data.library_signature !== currentSignature,
    };
  },

  async generateProfile(model = null) {
    const sb = getSupabase();
    const user_id = await requireUserId();
    const settings = loadAISettings();
    if (model) settings.model = model;

    const [movies, tvSeries] = await Promise.all([
      listRows({ type: 'movie', status: 'watched' }),
      listRows({ type: 'tv', status: 'watched' }),
    ]);
    if (movies.length === 0 && tvSeries.length === 0) {
      throw new Error('Add some watched titles before analyzing your taste.');
    }

    let feedbackRows = [];
    try {
      feedbackRows = await listFeedbackRows();
    } catch (e) {
      console.error('Failed to load rec feedback:', e.message);
    }

    let prior = null;
    try {
      const { data } = await sb
        .from(TASTE_TABLE)
        .select('profile_json, generated_at')
        .eq('user_id', user_id)
        .eq('scope', 'all')
        .maybeSingle();
      prior = data || null;
    } catch { /* no prior profile — fine */ }

    return generateAndSaveProfile({ sb, user_id, settings, movies, tvSeries, feedbackRows, prior });
  },

  // Called from the Generate flow (cloud only): regenerate the profile when the
  // library/feedback has changed enough, at most once per state per session.
  // Never throws — a failed refresh must not block recommendations.
  async maybeRefreshProfile({ model = null } = {}) {
    try {
      const sb = getSupabase();
      const user_id = await requireUserId();
      const { data: row } = await sb
        .from(TASTE_TABLE)
        .select('profile_json, library_signature, generated_at')
        .eq('user_id', user_id)
        .eq('scope', 'all')
        .maybeSingle();
      if (!row?.profile_json) return { refreshed: false, reason: null };

      const [movies, tvSeries] = await Promise.all([
        listRows({ type: 'movie', status: 'watched' }),
        listRows({ type: 'tv', status: 'watched' }),
      ]);
      let feedbackRows = [];
      try {
        feedbackRows = await listFeedbackRows();
      } catch { /* non-fatal */ }

      const { refresh, reason } = shouldAutoRefreshProfile({ row, movies, tvSeries, feedbackRows });
      if (!refresh) return { refreshed: false, reason: null };

      const guardKey = `${profileSignature(movies, tvSeries)}|${feedbackRows.length}`;
      if (autoRefreshTriedFor === guardKey) return { refreshed: false, reason: null };
      autoRefreshTriedFor = guardKey;

      const settings = loadAISettings();
      if (model) settings.model = model;
      const res = await generateAndSaveProfile({
        sb, user_id, settings, movies, tvSeries, feedbackRows,
        prior: { profile_json: row.profile_json, generated_at: row.generated_at },
      });
      return { refreshed: true, reason, profile: res.profile, generatedAt: res.generatedAt };
    } catch (e) {
      console.error('Auto taste refresh failed:', e.message);
      return { refreshed: false, reason: null, error: e.message };
    }
  },
};

// Shared by manual analyze + auto-refresh: run taste analysis with the raw
// feedback rows and prior profile (for drift), attach the history trail, upsert.
async function generateAndSaveProfile({ sb, user_id, settings, movies, tvSeries, feedbackRows, prior }) {
  const profile = await aiGenerateTasteProfile({
    movies,
    tvSeries,
    feedbackRows,
    priorProfile: prior ? compactProfileSnapshot(prior.profile_json, prior.generated_at) : null,
    settings,
  });
  profile.profileVersion = 2;
  if (prior?.profile_json) {
    const snap = compactProfileSnapshot(prior.profile_json, prior.generated_at);
    const oldHistory = Array.isArray(prior.profile_json.history) ? prior.profile_json.history : [];
    if (snap) profile.history = [snap, ...oldHistory].slice(0, 3);
  }
  const signature = profileSignature(movies, tvSeries);
  const nowIso = new Date().toISOString();
  const { error } = await sb.from(TASTE_TABLE).upsert(
    {
      user_id,
      scope: 'all',
      profile_json: profile,
      library_signature: signature,
      model: settings.model,
      generated_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: 'user_id,scope' }
  );
  if (error) throw new Error(error.message);

  return { profile, model: settings.model, signature, generatedAt: nowIso, stale: false };
}

// Feedback on AI recommendation cards — the durable personalization layer.
// One row per (user, normalized title, content type); re-reacting upserts.
export const feedbackApi = {
  async list({ content } = {}) {
    const rows = await listFeedbackRows(content || null);
    return { feedback: rows };
  },

  async record({ title, contentType = 'movie', feedback, year = null, genre = null, recType = null, model = null }) {
    if (!title) throw new Error('Title is required');
    if (!['interested', 'not_for_me', 'seen_it'].includes(feedback)) {
      throw new Error('Invalid feedback value');
    }
    const sb = getSupabase();
    const user_id = await requireUserId();
    const { data, error } = await sb
      .from(FEEDBACK_TABLE)
      .upsert(
        {
          user_id,
          title,
          normalized_title: normalizeTitle(title),
          content_type: contentType,
          feedback,
          year,
          genre,
          rec_type: recType,
          model,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,normalized_title,content_type' }
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async remove({ title, contentType = 'movie' }) {
    const sb = getSupabase();
    const user_id = await requireUserId();
    const { error } = await sb
      .from(FEEDBACK_TABLE)
      .delete()
      .eq('user_id', user_id)
      .eq('normalized_title', normalizeTitle(title))
      .eq('content_type', contentType);
    if (error) throw new Error(error.message);
    return { message: 'Feedback removed' };
  },
};
