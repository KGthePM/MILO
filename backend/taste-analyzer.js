require('dotenv').config();

const {
  buildLibraryDigest,
  buildTasteAnalysisPrompt,
  parseTasteProfileJSON,
  hashLibrary,
  callOllama,
} = require('./ollama-recommender');

// Signature over the whole watched library (movies + TV) so the UI can flag a
// profile as stale when the library changes — including rating/status edits,
// not just adds/removes. Mirrors profileSignature in frontend/src/api/cloud.js.
function profileSignature(movies = [], tvSeries = []) {
  const all = [...movies, ...tvSeries];
  if (all.length === 0) return '0:';
  return `${all.length}:${hashLibrary(all)}`;
}

// Compile a distilled, structured taste profile from the full library via Ollama.
async function generateTasteProfile(movies = [], tvSeries = [], model) {
  const resolvedModel = model || process.env.OLLAMA_MODEL;
  if (!resolvedModel) {
    throw new Error('No model specified. Pick one from the dropdown.');
  }

  const parts = [];
  if (movies.length) parts.push(buildLibraryDigest(movies, 'movies'));
  if (tvSeries.length) parts.push(buildLibraryDigest(tvSeries, 'TV series'));
  const digest = parts.join('\n\n') || 'My library is currently empty.';

  const { systemPrompt, userPrompt } = buildTasteAnalysisPrompt(digest, 'movies & TV');
  // Taste analysis is a longer free-form JSON than a rec list; give it room and
  // keep temperature modest for a faithful read.
  const response = await callOllama(userPrompt, systemPrompt, resolvedModel, { temperature: 0.6, numPredict: 1500 });
  const profile = parseTasteProfileJSON(response);
  if (!profile) {
    const snippet = String(response || '').trim().slice(0, 200);
    throw new Error(`Ollama did not return a valid taste profile: ${snippet || '(empty response)'}`);
  }
  return { profile, model: resolvedModel, signature: profileSignature(movies, tvSeries) };
}

module.exports = { generateTasteProfile, profileSignature };
