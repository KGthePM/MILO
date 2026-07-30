import { parseRecommendationsJSON } from '../prompt';

const BASE = 'https://api.anthropic.com/v1';

const KNOWN_MODELS = [
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

function headers(apiKey) {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'Content-Type': 'application/json',
  };
}

export async function listModels({ apiKey, signal } = {}) {
  if (!apiKey) throw new Error('Anthropic API key required.');
  try {
    const res = await fetch(`${BASE}/models`, { headers: headers(apiKey), signal });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const ids = (json.data || []).map((m) => m.id);
    return ids.length ? ids : KNOWN_MODELS;
  } catch {
    return KNOWN_MODELS;
  }
}

async function messages({ apiKey, model, systemPrompt, userPrompt, signal, maxTokens = 1200 }) {
  if (!apiKey) throw new Error('Anthropic API key required.');
  if (!model) throw new Error('Pick a Claude model.');
  const res = await fetch(`${BASE}/messages`, {
    method: 'POST',
    headers: headers(apiKey),
    signal,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.content?.map((c) => c.text || '').join('\n') || '';
}

export async function chat({ systemPrompt, userPrompt, apiKey, model, signal, maxTokens = 1200 }) {
  return messages({ apiKey, model, systemPrompt, userPrompt, signal, maxTokens });
}

export async function generateRecommendations({ systemPrompt, userPrompt, apiKey, model, signal }) {
  const text = await messages({ apiKey, model, systemPrompt, userPrompt, signal, maxTokens: 4000 });
  const parsed = parseRecommendationsJSON(text);
  if (!parsed || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
    const snippet = String(text || '').trim().slice(0, 200);
    throw new Error(`Anthropic did not return valid recommendations JSON: ${snippet || '(empty response)'}`);
  }
  return parsed.recommendations;
}

export async function chatAssistant({ systemPrompt, userPrompt, apiKey, model, signal }) {
  return messages({ apiKey, model, systemPrompt, userPrompt, signal, maxTokens: 600 });
}
