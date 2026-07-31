# MILO Skynet — Go-Live Plan

## Context

MILO is a free, personal movie/TV tracker. Data lives in Supabase (Postgres + Auth, RLS-scoped per user). AI features — recommendations, the assistant — are powered by **the user's own provider key**, called direct from the browser to OpenRouter, Anthropic, or a self-hosted Ollama. Your key, your model, your bill; it never touches a Milo-controlled server.

This shape is the product, not a workaround. It means:
- **Zero recurring AI cost to operate.** Inference is paid by whoever runs it.
- **No credential custody.** We never see, store, or proxy a provider key, so there's nothing to leak.
- **Free-tier infra is enough for launch.** Supabase free + Netlify free covers small-scale usage.
- **AI is opt-in.** A user can sign up and use the tracker (CRUD, Letterboxd import, browsing) without ever pasting a key — the AI panels just stay dormant until they do.

The cloud-mode code is shipped in the working tree (Supabase client, AuthGate, Settings modal with BYOK providers, RLS migration, SQLite→Supabase backfill script). The static landing page at `MILO_Landing/milo-landing/` is deployed on Netlify with a stub "Try Live Demo" button. This doc covers the operational work to make Milo publicly signup-able.

Decisions (locked in):
- **App host:** Netlify (second site under the same account as the landing page).
- **Domain topology:** subdomain split — landing at `milo.<domain>`, app at `app.milo.<domain>`. Fine to ship on raw `*.netlify.app` URLs first.
- **Email confirmation:** disabled — sign-up logs the user straight in.

## Positioning

**What MILO is:** a personal movie/TV log with optional AI recommendations. Sign up, log what you watched, browse, search, import from Letterboxd. If you want recommendations or an assistant, paste a provider key in Settings and they light up.

**What MILO is NOT:** a hosted-AI product. No key = no AI features, and that's fine — the tracker stands on its own. We do not proxy LLM calls, do not see user keys, and do not pay for anyone's inference. Future scope decisions should respect this line: if a feature would require us to custody a key or pay for tokens, the answer is no.

## What you need to provide

### A. Supabase project (free tier, ~5 min)

1. Sign in at https://supabase.com → **New project**.
2. Provide:
   - Project name (e.g. `milo`)
   - A **database password** (save it; not used at runtime but needed for any direct DB tooling later)
   - A region close to your users
3. Once provisioned, go to **SQL Editor → New query**, paste the entire contents of `supabase/migrations/0001_init.sql`, and run it. This creates the `movies` table with RLS + four owner policies.
4. **Settings → API**, copy two values for later:
   - `Project URL` → goes into `VITE_SUPABASE_URL`
   - `anon` `public` key → goes into `VITE_SUPABASE_ANON_KEY`
   - (Also visible: `service_role` key — keep this secret. Only used by `scripts/migrate-sqlite-to-supabase.js` if you backfill your personal `movies.db`.)
5. **Authentication → Providers → Email**: leave Email enabled. **Uncheck "Confirm email"**. Save.
6. **Authentication → URL Configuration**:
   - **Site URL** = the app's URL (e.g. `https://milo-app.netlify.app` to start; later `https://app.<your-domain>`)
   - **Redirect URLs**: add the same URL, plus `http://localhost:5173` for local dev

### B. App deployment on Netlify (~5 min)

1. Netlify → **Add new site → Import from Git** → point at this repo with:
   - **Base directory:** `frontend`
   - Build command and publish directory come from `frontend/netlify.toml` (which also adds the SPA `/* → /index.html` redirect — without that file, the deploy 404s).
2. **Site settings → Environment variables**, add three:
   - `VITE_MILO_MODE=cloud`
   - `VITE_SUPABASE_URL=<from step A.4>`
   - `VITE_SUPABASE_ANON_KEY=<from step A.4>`
3. Trigger a deploy. Note the resulting `https://<name>.netlify.app` URL — that's the URL you put back into Supabase Site URL (step A.6) if it wasn't already.

### C. Landing → App wiring (one HTML edit)

In `MILO_Landing/milo-landing/index.html`:
- **~Line 300** — replace `href="#"` on the "Try Live Demo" anchor with `href="https://<app-url>"` and add `target="_blank"` (keeps the landing tab open).
- **Nav block (~lines 248–265)** — add a sibling `<a>` "Sign In" next to the existing GitHub link, same `text-gray-300 hover:text-cyan-400` styling, pointing at the same URL.

(Line numbers are approximate — search by class/text rather than trusting the line if the file has been touched.)

`AuthGate.jsx` already renders the sign-up/sign-in form for any unauthenticated visitor, so a single link is enough — no need to embed Supabase JS into the static landing page.

### D. (Optional) Backfill your personal data

Once you've signed up on the deployed app, grab your `auth.uid()` from Supabase **Authentication → Users**, then locally:

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
node scripts/migrate-sqlite-to-supabase.js --user-id <your-uuid>
```

Reads `movies.db`, stamps every row with your user_id, bulk-inserts. Pass `--dry` first to preview.

## Files changed in this phase

- `MILO_Landing/milo-landing/index.html` — the only file edited (two small `href` changes described in section C).
- **No code changes required in `frontend/`.** The login UI already exists in `frontend/src/components/AuthGate.jsx`.

## What to skip (don't over-engineer v1)

- **No embedded sign-in form on the landing page.** Adding Supabase JS to the static page complicates CSP (current `netlify.toml` doesn't allow `*.supabase.co`) and duplicates UI. A plain link is enough.
- **No custom domain in v1.** Ship on `*.netlify.app` first; custom domain is a 5-minute follow-up once it works.
- **No social OAuth providers.** Email-only for v1. Adding Google/GitHub later is a Supabase dashboard toggle + redirect URL update.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Email signups → spam accounts (because confirmation is off) | Watch sign-ups in the Supabase dashboard for the first week; flip "Confirm email" back on if abuse appears. |
| Anthropic browser CORS gets stricter | `frontend/src/ai/providers/anthropic.js` already sends `anthropic-dangerous-direct-browser-access: true`, but Anthropic could revoke browser access at any time. OpenRouter is the recommended default in the Settings UI for exactly this reason — one key, many models, no CORS surprises — so a future Anthropic break is a graceful degradation rather than an outage. |
| Forgot Supabase Redirect URL → users stuck after signup link | Confirmation is disabled, so the redirect URL only matters if we later add OAuth or magic links. Revisit when either ships. |
| Local dev (`localhost:5173`) hitting prod Supabase pollutes data | Use a second Supabase project for dev, or accept that your personal account is the only dev user. v1: single project is fine. |

## Verification (end-to-end)

1. **Cloud build smoke:** `cd frontend && VITE_MILO_MODE=cloud VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… npm run build` — already known to pass locally.
2. **Live signup:** open the deployed app URL in a clean browser, click "Sign up", create an account with a throwaway email. Should land straight into an empty Movies dashboard (no email confirmation step).
3. **RLS sanity:** in a private window, sign up as a second user, add a movie, switch back to the first account — the second user's movie must not be visible.
4. **BYOK isolation:** in DevTools → Network on the deployed app, paste an OpenRouter key in Settings, click Generate. Confirm the API key only appears in requests to `openrouter.ai` — never to any `*.netlify.app` or `*.supabase.co` URL.
5. **Landing → app handoff:** redeploy the landing page, click "Try Live Demo", confirm it lands on the app and the AuthGate sign-in screen renders.
6. **Personal-data backfill (optional):** run the migration script with `--dry`, confirm preview rows look right, then run without `--dry`. In the app, refresh — your movies should appear.
7. **AI-off path works:** sign up as a fresh user and *do not* paste any provider key. Movie/TV CRUD, search, browsing, and Letterboxd import must all work. The recommendations panel should show a calm "add a key in Settings" empty state, not an error. This is the load-bearing check on the Positioning section — if it regresses, the "tracker stands on its own" claim breaks.
