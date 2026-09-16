import { parseRecommendationsJSON } from '../prompt';
import { IS_CLOUD } from '../../utils/mode';

const PROXY_URL = '/.netlify/functions/zai-proxy';

// In the iOS app (Capacitor) the page origin is capacitor://localhost, so a
// relative proxy path resolves to nothing. Use the deployed site's function
// endpoint instead. VITE_ZAI_PROXY_URL can override both cases.
function resolveProxyUrl() {
  const configured = import.meta.env.VITE_ZAI_PROXY_URL;
  if (configured) return configured;
  const proto = typeof window !== 'undefined' ? window.location.protocol : '';
  if (proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:') {
    return 'https://milo-movies.netlify.app' + PROXY_URL;
  }
  return PROXY_URL;
}

function normalizeBaseUrl(url, label) {
  if (!url) throw new Error(`${label} base URL required.`);
  const trimmed = String(url).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(`${label}: Base URL must start with http:// or https:// (got "${url}")`);
  }
  return trimmed;
}

// Our own budget for a single request. Sits just under the 55s the z.ai proxy
// allows itself, which in turn sits under Netlify's hard 60s function limit —
// so whichever layer gives up first, the user sees a real message (and, on the
// streaming path, keeps whatever text already arrived).
const CLIENT_TIMEOUT_MS = 58000;

// Merge the caller's cancellation signal with our own deadline.
function withDeadline(signal) {
  const deadline = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  if (!signal) return deadline;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, deadline]);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted || deadline.aborted) controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  deadline.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

async function formatHttpError(res, label, bodyText) {
  const status = `${res.status}${res.statusText ? ' ' + res.statusText : ''}`;
  const contentType = res.headers.get('content-type') || '';
  let body = bodyText;
  if (body === undefined) {
    body = '';
    try { body = await res.text(); } catch { /* ignore */ }
  }
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
      // AWS Lambda/Netlify function-invocation-wrapper shape, seen when the
      // underlying function is killed (e.g. execution timeout) before it can
      // return a normal response. Not a provider API error shape.
      if (json && typeof json.errorType === 'string' && typeof json.errorMessage === 'string') {
        if (res.status === 502 || res.status === 504) {
          return `${label}: request timed out generating the response (${res.status})`;
        }
        return `${label}: ${status} ${json.errorMessage}`;
      }
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
  // Extra body fields merged into generateRecommendations' request (and
  // reusable by other large single-shot JSON-generation calls, e.g. taste
  // profile analysis). Used by z.ai/zaiCoding to disable GLM's "thinking"
  // mode, which defaults to enabled and can push generation past the host
  // platform's function execution limit for an 8000-token structured-JSON
  // request. No-op for providers that don't set it.
  jsonGenerationExtraBody = null,
  // Same mechanism for chatAssistant's request.
  assistantExtraBody = null,
  // Opt-in SSE streaming. Streaming doesn't raise any execution limit, but it
  // means tokens arrive as they're produced, so a request that gets cut short
  // still yields usable partial text instead of nothing at all. Off by default
  // so providers that haven't been exercised on this path keep today's
  // buffered behaviour.
  supportsStreaming = false,
  // Output cap for generateRecommendations (and taste-profile analysis, which
  // reads it off the provider). Lowered for providers that need to finish
  // inside a tight execution budget.
  jsonGenerationMaxTokens = 8000,
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
    const res = await fetch(resolveProxyUrl(), {
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

  async function chat({ apiKey, model, systemPrompt, userPrompt, signal, maxTokens = 1200, baseUrl: baseUrlOverride, name: nameOverride, extraBody = {}, onToken = null }) {
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
      ...extraBody,
    };
    const streaming = supportsStreaming;
    if (streaming) requestBody.stream = true;

    const runSignal = withDeadline(signal);

    async function send(body) {
      if (useProxy) {
        return proxyRequest('/chat/completions', { apiKey, body, signal: runSignal });
      }
      const url = normalizeBaseUrl(baseUrlOverride || baseUrl, label);
      return fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        signal: runSignal,
        body: JSON.stringify(body),
      });
    }

    let res = await send(requestBody);
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch { /* ignore */ }
      // Some GLM models refuse to have reasoning turned off (HTTP 400, code
      // 1210) rather than ignoring the field. Drop `thinking` and try once
      // more so disabling it can never be worse than not sending it.
      if (res.status === 400 && 'thinking' in requestBody && /thinking/i.test(errText)) {
        const retryBody = { ...requestBody };
        delete retryBody.thinking;
        res = await send(retryBody);
        if (!res.ok) throw new Error(await formatHttpError(res, label));
      } else {
        throw new Error(await formatHttpError(res, label, errText));
      }
    }

    const isEventStream = (res.headers.get('content-type') || '').includes('text/event-stream');
    if (streaming && isEventStream && res.body) {
      return readEventStream(res, onToken, signal);
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
  }

  // Consume an OpenAI-style SSE completion, accumulating `delta.content`. If
  // the connection dies partway (our deadline, or the host cutting the
  // function off) we return the text collected so far rather than throwing —
  // truncated JSON still has salvage logic downstream, and a truncated
  // assistant reply is already on screen. A caller-initiated cancel still
  // propagates, and so does a failure that produced nothing.
  async function readEventStream(res, onToken, callerSignal) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return text;
          try {
            const chunk = JSON.parse(data);
            const choice = chunk.choices?.[0];
            const delta = choice?.delta?.content || choice?.message?.content || '';
            if (delta) {
              text += delta;
              if (onToken) onToken(delta, text);
            }
          } catch { /* keepalive or split frame — ignore */ }
        }
      }
    } catch (err) {
      if (callerSignal?.aborted || !text) throw err;
    }
    return text;
  }

  async function generateRecommendations(opts) {
    const label = (opts && opts.name) || name;
    const text = await chat({
      ...opts,
      maxTokens: jsonGenerationMaxTokens,
      extraBody: { ...(opts.extraBody || {}), ...(jsonGenerationExtraBody || {}) },
    });
    const parsed = parseRecommendationsJSON(text);
    if (!parsed || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
      const snippet = String(text || '').trim().slice(0, 200);
      throw new Error(`${label} did not return valid recommendations JSON: ${snippet || '(empty response)'}`);
    }
    return parsed.recommendations;
  }

  async function chatAssistant(opts) {
    return chat({
      ...opts,
      maxTokens: 2000,
      extraBody: { ...(opts.extraBody || {}), ...(assistantExtraBody || {}) },
    });
  }

  return {
    listModels,
    chat,
    generateRecommendations,
    chatAssistant,
    jsonGenerationExtraBody,
    jsonGenerationMaxTokens,
  };
}
