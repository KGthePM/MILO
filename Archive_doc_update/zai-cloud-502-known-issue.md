# z.ai / z.ai Coding — 502 on Recommendations + Assistant

Status: **RESOLVED.** Fixed in commit `88b07c2`, deployed to Netlify, and confirmed working in production by the user on 2026-09-11.

## Symptom

Cloud mode, BYOK provider set to **z.ai** or **z.ai Coding** only (no other provider affected):

```
z.ai Coding: 502 {"errorType":"Error","errorMessage":"An unknown error has occurred"}
```

- **Recommendations**: failed every time.
- **MILO Assistant**: failed on open-ended quick prompts ("Analyze my taste," "Recommend hidden gems," "What should I watch this weekend?"); narrow ones ("Find similar movies/TV shows") were less prone to it.

## Root cause

1. `frontend/netlify/functions/zai-proxy.js` relays browser requests to `api.z.ai` server-side, because `api.z.ai` sends no CORS headers. It used to fully buffer the upstream response (`await upstreamRes.text()`) with no timeout of its own.
2. **Netlify Functions have a hard, non-configurable 60-second synchronous execution limit** on every plan tier. Edge Functions are worse (headers capped at 40s); Background Functions are fire-and-forget, so unusable here.
3. `{"errorType":"Error","errorMessage":"An unknown error has occurred"}` is the AWS Lambda/Netlify crash wrapper emitted when the function is killed at that limit. Not a z.ai error, and not produced by any code in `zai-proxy.js`.
4. GLM's `thinking` (extended hidden reasoning) **defaults to enabled**, and nothing set it otherwise. Long reasoning traces — not output size — are what push past 60s. Recommendations (`maxTokens: 8000`, prompt with up to 300 watched titles) and Taste Profile (same cap) were the worst cases; the assistant's fixed `maxTokens: 2000` prompt still blew the budget on questions that invite long reasoning.

## Why the earlier single-lever fix wasn't enough

The first pass set `thinking: {type: 'disabled'}` on JSON-generation calls only, and was never deployed. Two problems found since:

- **Streaming does not extend the Netlify limit.** 60s applies to streamed responses too; only the payload cap changes (6 MB → 20 MB). Streaming is a survivability measure, not a timeout workaround.
- **`thinking: disabled` is not reliable on z.ai.** Multiple reports show the API ignoring the field on some endpoints, and newer GLM models reject it outright with HTTP 400 code 1210 ("This model always engages in thinking and cannot be disabled"). Depending on it alone would have *introduced* a hard failure on those models.

So the fix no longer depends on any single lever.

## Fix now in place

**`frontend/netlify/functions/zai-proxy.js`**
- Upstream fetch carries `AbortSignal.timeout(55_000)` — we give up just before Netlify kills us and return a real `504 {"error": "Upstream request timed out after 55s"}` instead of the opaque crash body.
- When the forwarded body has `stream: true` and upstream is OK, `upstreamRes.body` is piped straight back as `text/event-stream` with no buffering. Error responses and `/models` stay buffered.
- Key handling, path/provider allowlists, and the no-logging guarantee are unchanged.

**`frontend/src/ai/providers/_openaiCompatible.js`**
- New factory options, no-ops for the other 13 providers: `supportsStreaming` (default `false`), `jsonGenerationMaxTokens` (default `8000`).
- `chat()` takes `onToken` and, when the provider supports streaming, sets `stream: true` and consumes the SSE via `res.body.getReader()`, accumulating `choices[0].delta.content`. Falls back to the buffered JSON path if the response isn't actually an event stream.
- **Client deadline**: the caller's signal is merged with `AbortSignal.timeout(58_000)` (`withDeadline`, with an `AbortController` fallback where `AbortSignal.any` is missing). If the stream dies after text has accumulated, the partial text is returned rather than thrown — `parseRecommendationsJSON`'s `salvageRecommendations` recovers complete items from truncated JSON, and a partial assistant reply is already on screen. A caller-initiated cancel still propagates, and a failure that produced nothing still throws.
- **`thinking` rejection retry**: on HTTP 400 whose body mentions thinking, the request is retried once with the `thinking` key stripped. This is what makes asking for it off strictly safe.
- `generateRecommendations` uses `jsonGenerationMaxTokens`; `formatHttpError()` accepts an already-read body and still reports the Lambda-crash shape as `"<label>: request timed out generating the response (502)"`.

**`frontend/src/ai/providers/zai.js` / `zaiCoding.js`** — both now set `assistantExtraBody: { thinking: { type: 'disabled' } }` (closing the assistant gap), `supportsStreaming: true`, and `jsonGenerationMaxTokens: 3000`.

**`frontend/src/ai/index.js`** — `chatAssistant` accepts and forwards `onToken`; `generateTasteProfile` uses `provider.jsonGenerationMaxTokens || 8000`.

**`frontend/src/api/cloud.js`** — `getRecommendations()` runs its up to 4 AI calls concurrently via `Promise.allSettled` (latency, not a timeout fix); `assistantApi.chatWithAssistant` takes a trailing `{ onToken }` and forwards it. `assistantApi.local.js` accepts and ignores it for signature parity.

**`frontend/src/components/shared/AssistantModal.jsx`** — the assistant reply streams into the chat bubble as tokens arrive. The bubble is only created on the first token, so non-streaming providers behave exactly as before. Persistence to `localStorage` is skipped while streaming (it would otherwise write once per token), and a partial reply is kept on screen alongside the error if the request fails mid-stream.

## Verified so far

Unit harnesses against a fake SSE upstream (not committed; run ad hoc) confirmed: SSE accumulation with split frames, `onToken` firing per delta, `stream: true` reaching upstream, non-streaming providers unchanged, fallback when upstream returns plain JSON, the thinking-400 retry dropping the field, partial text returned on a mid-stream cutoff, caller aborts still propagating, proxy stream passthrough/content-type/auth header/timeout signal, buffered and error paths intact, 504 on timeout, and both allowlists. `VITE_MILO_MODE=cloud npm run build` passes.

## Confirmed in production

Deployed to Netlify from `main` and tested by the user against the live cloud site on 2026-09-11 — Recommendations and the Assistant both work with z.ai / z.ai Coding selected.

## Lessons learned

1. **An undeployed fix can't be judged by a prod retest.** This issue looked like a failed fix for a whole round because the earlier `thinking: disabled` change existed only as an uncommitted local diff while the live Netlify site was being retested. The identical error was evidence of nothing. Check what code is actually deployed before concluding an approach is wrong — and note that `netlify dev`, not plain `vite dev`, is required to exercise Netlify Functions locally.
2. **Verify vendor assumptions against live docs.** Two load-bearing beliefs turned out to be false: that streaming would buy more time (Netlify's 60s cap applies to streamed responses too — only the payload cap changes, 6 MB → 20 MB), and that `thinking: {type:'disabled'}` reliably disables GLM reasoning (it's ignored on some endpoints, and newer models reject it outright with HTTP 400 code 1210).
3. **Layer independent mitigations instead of betting on one.** The single-lever fix would have *introduced* a new hard failure on models that reject the `thinking` field. What worked was four mitigations plus a graceful-degradation path, so no single wrong assumption sinks the whole thing.
4. **Decode the error before chasing it.** `{"errorType":"Error","errorMessage":"An unknown error has occurred"}` is the Lambda crash wrapper, not a provider error — recognizing that is what pointed at the 60s limit rather than at z.ai.
5. **Design for the ceiling you don't control.** 60s is still a hard cap. Returning partial text on a cut-off stream (salvaged for JSON, shown as a partial reply in chat) means hitting it degrades instead of failing.

## If it recurs

- **502s come back**: port the proxy to a Supabase Edge Function — 150s wall clock free, 400s paid, CORS headers under our control. Cloud mode already depends on Supabase, so it's a deploy-step change (`supabase functions deploy`), not a new dependency.
- **z.ai Coding specifically stays slow**: its `/api/coding/paas/v4` surface is built for agentic coding flows, not one-shot chat/JSON. Consider a UI hint steering users to plain z.ai for this app's workload.
- **Untested paths**: a non-proxied provider (e.g. OpenRouter) hasn't been spot-checked in prod since this change; the buffered path is unchanged by design and covered by the local harness, but it's the first thing to check if another provider misbehaves.
