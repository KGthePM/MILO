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

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { provider, path, apiKey, body } = payload || {};
  const base = TARGETS[provider];
  if (!base) {
    return new Response(JSON.stringify({ error: `Unknown provider "${provider}"` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!ALLOWED_PATHS.has(path)) {
    return new Response(JSON.stringify({ error: `Unsupported path "${path}"` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'apiKey required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upstreamInit = {
    method: path === '/models' ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (upstreamInit.method === 'POST') {
    upstreamInit.body = JSON.stringify(body || {});
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(`${base}${path}`, upstreamInit);
  } catch (err) {
    return new Response(JSON.stringify({ error: `Upstream request failed: ${err.message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const text = await upstreamRes.text();
  return new Response(text, {
    status: upstreamRes.status,
    headers: { 'Content-Type': upstreamRes.headers.get('content-type') || 'application/json' },
  });
};
