import { parseRecommendationsJSON } from '../prompt';
import { IS_CLOUD } from '../../utils/mode';

const PROXY_URL = '/.netlify/functions/zai-proxy';

function normalizeBaseUrl(url, label) {
  if (!url) throw new Error(`${label} base URL required.`);
  const trimmed = String(url).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(`${label}: Base URL must start with http:// or https:// (got "${url}")`);
  }
  return trimmed;
}

async function formatHttpError(res, label) {
  const status = `${res.status}${res.statusText ? ' ' + res.statusText : ''}`;
  const contentType = res.headers.get('content-type') || '';
  let body = '';
  try { body = await res.text(); } catch { /* ignore */ }
  const trimmed = body.trim();
  const looksHtml = contentType.includes('text/html') || trimmed.startsWith('<');
  if (looksHtml) {
    let origin = '';
    try { origin = new URL(res.url).host; } catch { /* ignore */ }
    const where = origin ? ` from ${origin}` : '';
    return `${label}: ${status}${where} (non-JSON response — check Base URL)`;
  }
  if (contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      const msg = json?.error?.message || json?.error || json?.message;
      if (msg) return `${label}: ${status} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`;
    } catch { /* fall through */ }
  }
  const snippet = trimmed.length > 200 ? trimmed.slice(0, 200) + '…' : trimmed;
  return snippet ? `${label}: ${status} ${snippet}` : `${label}: ${status}`;
}

export function createOpenAICompatibleProvider({
  name,
  baseUrl,
  modelsPath = '/models',
  defaultModels = [],
  extraHeaders = {},
  proxied = false,
  proxyKey = null,
}) {
  function authHeaders(apiKey) {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
  }

  // api.z.ai (zai / zaiCoding) doesn't send Access-Control-Allow-Origin on
  // its preflight, so a direct browser fetch() is blocked by CORS. Route
  // those two providers through a same-origin Netlify Function instead,
  // which makes the request server-side where CORS doesn't apply. The key
  // is forwarded per-request only, never stored by the function.
  const useProxy = proxied && IS_CLOUD;

  async function proxyRequest(path, { apiKey, body, signal }) {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ provider: proxyKey, path, apiKey, body }),
    });
    return res;
  }

  async function listModels({ apiKey, signal, baseUrl: baseUrlOverride, name: nameOverride } = {}) {
    const label = nameOverride || name;
    if (!apiKey) throw new Error(`${label} API key required.`);
    try {
      let res;
      if (useProxy) {
        res = await proxyRequest(modelsPath, { apiKey, signal });
      } else {
        const url = normalizeBaseUrl(baseUrlOverride || baseUrl, label);
        res = await fetch(`${url}${modelsPath}`, { headers: authHeaders(apiKey), signal });
      }
      if (!res.ok) return [...defaultModels];
      const json = await res.json();
      const ids = (json.data || json.models || [])
        .map((m) => m.id || m.name)
        .filter(Boolean);
      return ids.length ? ids : [...defaultModels];
    } catch {
      return [...defaultModels];
    }
  }

  async function chat({ apiKey, model, systemPrompt, userPrompt, signal, maxTokens = 1200, baseUrl: baseUrlOverride, name: nameOverride }) {
    const label = nameOverride || name;
    if (!apiKey) throw new Error(`${label} API key required.`);
    if (!model) throw new Error('Pick a model from the dropdown.');
    const requestBody = {
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };
    let res;
    if (useProxy) {
      res = await proxyRequest('/chat/completions', { apiKey, body: requestBody, signal });
    } else {
      const url = normalizeBaseUrl(baseUrlOverride || baseUrl, label);
      res = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        signal,
        body: JSON.stringify(requestBody),
      });
    }
    if (!res.ok) throw new Error(await formatHttpError(res, label));
    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
  }

  async function generateRecommendations(opts) {
    const label = (opts && opts.name) || name;
    const text = await chat({ ...opts, maxTokens: 8000 });
    const parsed = parseRecommendationsJSON(text);
    if (!parsed || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
      const snippet = String(text || '').trim().slice(0, 200);
      throw new Error(`${label} did not return valid recommendations JSON: ${snippet || '(empty response)'}`);
    }
    return parsed.recommendations;
  }

  async function chatAssistant(opts) {
    return chat({ ...opts, maxTokens: 2000 });
  }

  return { listModels, chat, generateRecommendations, chatAssistant };
}
