import {
  buildRecommendationPrompt,
  buildAssistantPrompt,
  buildLibraryDigest,
  buildTasteAnalysisPrompt,
  parseTasteProfileJSON,
} from './prompt';
import * as openrouter from './providers/openrouter';
import * as anthropic from './providers/anthropic';
import * as ollama from './providers/ollama';
import * as zai from './providers/zai';
import * as zaiCoding from './providers/zaiCoding';
import * as deepseek from './providers/deepseek';
import * as groq from './providers/groq';
import * as xai from './providers/xai';
import * as mistral from './providers/mistral';
import * as together from './providers/together';
import * as cerebras from './providers/cerebras';
import * as fireworks from './providers/fireworks';
import * as googleai from './providers/googleai';
import * as custom from './providers/custom';
import { loadAISettings, getActiveKey } from '../utils/aiSettings';

const REGISTRY = {
  openrouter, anthropic, ollama,
  zai, zaiCoding, deepseek, groq, xai, mistral, together, cerebras, fireworks, googleai, custom,
};

export function getProvider(name) {
  const p = REGISTRY[name];
  if (!p) throw new Error(`Unknown AI provider: ${name}`);
  return p;
}

function providerCallOpts(settings, extra = {}) {
  if (settings.provider === 'ollama') {
    return { ollamaUrl: settings.ollamaUrl, model: settings.model, ...extra };
  }
  if (settings.provider === 'custom') {
    return {
      apiKey: getActiveKey(settings),
      model: settings.model,
      baseUrl: settings.customBaseUrl,
      name: settings.customLabel || 'Custom',
      ...extra,
    };
  }
  return { apiKey: getActiveKey(settings), model: settings.model, ...extra };
}

export async function listModels(settings = loadAISettings(), { signal } = {}) {
  const provider = getProvider(settings.provider);
  return provider.listModels({ ...providerCallOpts(settings), signal });
}

export async function generateRecommendations({
  userMovies,
  type,
  contentType,
  extraExclusions = [],
  tasteProfile = null,
  feedback = null,
  settings = loadAISettings(),
  signal,
} = {}) {
  const { systemPrompt, userPrompt } = buildRecommendationPrompt(userMovies, type, contentType, {
    extraExclusions,
    tasteProfile,
    feedback,
  });
  const provider = getProvider(settings.provider);
  return provider.generateRecommendations({
    systemPrompt,
    userPrompt,
    ...providerCallOpts(settings),
    signal,
  });
}

// Compile a distilled taste profile from the full library via the provider's
// generic chat path (no per-provider capability needed).
export async function generateTasteProfile({
  movies = [],
  tvSeries = [],
  feedback = null,
  settings = loadAISettings(),
  signal,
} = {}) {
  const parts = [];
  if (movies.length) parts.push(buildLibraryDigest(movies, 'movies'));
  if (tvSeries.length) parts.push(buildLibraryDigest(tvSeries, 'TV series'));
  // Reactions to past AI recommendations are taste signal too. Text kept
  // identical to backend/taste-analyzer.js.
  const fbInterested = (feedback?.interested || []).slice(0, 15);
  const fbNotForMe = (feedback?.notForMe || []).slice(0, 15);
  if (fbInterested.length || fbNotForMe.length) {
    const fbLines = [];
    if (fbInterested.length) fbLines.push(`- Added to watchlist (excited me): ${fbInterested.join('; ')}`);
    if (fbNotForMe.length) fbLines.push(`- Rejected ("not for me"): ${fbNotForMe.join('; ')}`);
    parts.push(`Feedback I gave on AI recommendations:\n${fbLines.join('\n')}`);
  }
  const digest = parts.join('\n\n') || 'My library is currently empty.';
  const { systemPrompt, userPrompt } = buildTasteAnalysisPrompt(digest, 'movies & TV');
  const provider = getProvider(settings.provider);
  if (typeof provider.chat !== 'function') {
    throw new Error(`${settings.provider} does not support taste analysis.`);
  }
  const text = await provider.chat({
    systemPrompt,
    userPrompt,
    ...providerCallOpts(settings),
    maxTokens: 8000,
    signal,
  });
  const profile = parseTasteProfileJSON(text);
  if (!profile) {
    const snippet = String(text || '').trim().slice(0, 200);
    throw new Error(`${settings.provider} did not return a valid taste profile: ${snippet || '(empty response)'}`);
  }
  return profile;
}

export async function chatAssistant({
  message,
  movies = [],
  tvSeries = [],
  analytics = null,
  history = [],
  tasteProfile = null,
  settings = loadAISettings(),
  signal,
} = {}) {
  const { systemPrompt, userPrompt } = buildAssistantPrompt(message, movies, tvSeries, analytics, history, tasteProfile);
  const provider = getProvider(settings.provider);
  const response = await provider.chatAssistant({
    systemPrompt,
    userPrompt,
    ...providerCallOpts(settings),
    signal,
  });
  return { response, modelUsed: settings.model, provider: settings.provider };
}
