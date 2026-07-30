import { parseRecommendationsJSON } from '../prompt';

const BASE = 'https://openrouter.ai/api/v1';

function authHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://milo.local',
    'X-Title': 'MILO',
  };
}

export async function listModels({ apiKey, signal } = {}) {
  if (!apiKey) throw new Error('OpenRouter API key required.');
  const res = await fetch(`${BASE}/models`, { headers: authHeaders(apiKey), signal });
  if (!res.ok) throw new Error(`OpenRouter models: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return (json.data || []).map((m) => m.id);
}

export async function chat({ apiKey, model, systemPrompt, userPrompt, signal, maxTokens = 1200 }) {
  if (!apiKey) throw new Error('OpenRouter API key required.');
  if (!model) throw new Error('Pick a model from the dropdown.');
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    signal,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

export async function generateRecommendations({ systemPrompt, userPrompt, apiKey, model, signal }) {
  const text = await chat({ apiKey, model, systemPrompt, userPrompt, signal, maxTokens: 4000 });
  const parsed = parseRecommendationsJSON(text);
  if (!parsed || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
    const snippet = String(text || '').trim().slice(0, 200);
    throw new Error(`OpenRouter did not return valid recommendations JSON: ${snippet || '(empty response)'}`);
  }
  return parsed.recommendations;
}

export async function chatAssistant({ systemPrompt, userPrompt, apiKey, model, signal }) {
  return chat({ apiKey, model, systemPrompt, userPrompt, signal, maxTokens: 600 });
}
