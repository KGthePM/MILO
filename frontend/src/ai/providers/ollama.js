import { parseRecommendationsJSON } from '../prompt';

function normalize(url) {
  return (url || 'http://localhost:11434').replace(/\/+$/, '');
}

export async function listModels({ ollamaUrl, signal } = {}) {
  const res = await fetch(`${normalize(ollamaUrl)}/api/tags`, { signal });
  if (!res.ok) throw new Error(`Ollama: ${res.status}`);
  const json = await res.json();
  return (json.models || []).map((m) => m.name).filter((n) => !/embed/i.test(n));
}

async function generate({ ollamaUrl, model, systemPrompt, userPrompt, signal, numPredict = 1000 }) {
  if (!model) throw new Error('Pick an Ollama model.');
  const res = await fetch(`${normalize(ollamaUrl)}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      stream: false,
      options: { temperature: 0.7, num_predict: numPredict },
    }),
  });
  if (!res.ok) throw new Error(`Ollama: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.response || '';
}

export async function generateRecommendations({ systemPrompt, userPrompt, ollamaUrl, model, signal }) {
  const text = await generate({ ollamaUrl, model, systemPrompt, userPrompt, signal, numPredict: 4000 });
  const parsed = parseRecommendationsJSON(text);
  if (!parsed || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
    const snippet = String(text || '').trim().slice(0, 200);
    throw new Error(`Ollama did not return valid recommendations JSON: ${snippet || '(empty response)'}`);
  }
  return parsed.recommendations;
}

export async function chatAssistant({ systemPrompt, userPrompt, ollamaUrl, model, signal }) {
  return generate({ ollamaUrl, model, systemPrompt, userPrompt, signal, numPredict: 500 });
}
