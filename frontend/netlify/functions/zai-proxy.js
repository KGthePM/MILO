// Server-side relay for the z.ai / z.ai Coding BYOK providers.
//
// api.z.ai does not send Access-Control-Allow-Origin on its preflight
// response, so a direct browser fetch() is blocked by CORS before it ever
// reaches z.ai (see frontend/src/ai/providers/_openaiCompatible.js). This
// function makes the same request server-side, where CORS doesn't apply,
// and forwards the response straight back. The caller's API key is used to
// build the outgoing Authorization header only — it is never logged,
// stored, or persisted anywhere here.

const TARGETS = {
  zai: 'https://api.z.ai/api/paas/v4',
  zaiCoding: 'https://api.z.ai/api/coding/paas/v4',
};

const ALLOWED_PATHS = new Set(['/chat/completions', '/models']);

// Netlify's synchronous function execution limit is a hard, non-configurable
// 60s on every plan tier (streaming does not raise it). Stay just under it.
const UPSTREAM_TIMEOUT_MS = 55000;

export default async (req) => {
  // CORS: the deployed site calls this same-origin, but the iOS app
  // (Capacitor webview) calls it cross-origin from capacitor://localhost.
  // Echo only known-good origins — never reflect arbitrary ones with
  // credentials allowed.
  const corsHeaders = (origin) => {
    const allowed = new Set([
      'capacitor://localhost',
      'ionic://localhost',
      'https://milo-movies.netlify.app',
    ]);
    const base = { 'Access-Control-Allow-Headers': 'Content-Type' };
    if (allowed.has(origin)) {
      return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    }
    return base;
  };
  const origin = req.headers.get('origin') || '';

  if (req.method === 'OPTIONS') {
    // Preflight for the Capacitor webview origin.
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // Attach CORS headers to every JSON/stream response below.
  const cors = corsHeaders(origin);

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { provider, path, apiKey, body } = payload || {};
  const base = TARGETS[provider];
  if (!base) {
    return new Response(JSON.stringify({ error: `Unknown provider "${provider}"` }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (!ALLOWED_PATHS.has(path)) {
    return new Response(JSON.stringify({ error: `Unsupported path "${path}"` }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'apiKey required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const upstreamInit = {
    method: path === '/models' ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // Netlify kills a synchronous function at a hard 60s and replaces the
    // response with an opaque Lambda crash body. Bail out just short of that
    // so the caller gets a real error it can render instead.
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  };
  if (upstreamInit.method === 'POST') {
    upstreamInit.body = JSON.stringify(body || {});
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(`${base}${path}`, upstreamInit);
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    return new Response(
      JSON.stringify({
        error: timedOut
          ? `Upstream request timed out after ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)}s`
          : `Upstream request failed: ${err.message}`,
      }),
      {
        status: timedOut ? 504 : 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }
    );
  }

  // Streamed completions are piped straight back to the browser without
  // buffering, so the caller starts receiving tokens immediately and keeps
  // whatever arrived even if the request is cut short.
  const wantsStream = upstreamInit.method === 'POST' && body && body.stream === true;
  if (wantsStream && upstreamRes.ok && upstreamRes.body) {
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: {
        ...cors,
        'Content-Type': upstreamRes.headers.get('content-type') || 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const text = await upstreamRes.text();
  return new Response(text, {
    status: upstreamRes.status,
    headers: { ...cors, 'Content-Type': upstreamRes.headers.get('content-type') || 'application/json' },
  });
};
