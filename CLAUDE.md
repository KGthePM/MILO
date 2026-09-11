# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> A parallel `AGENTS.md` covers the same ground in more detail; keep the two in sync when either changes.

## Project Overview

**MILO** — a movie, TV, and podcast tracking dashboard. One React frontend, two data/AI backends selected at **build time** via `VITE_MILO_MODE=local|cloud` (default `local`):

- **Local mode**: React frontend + Express 5 / SQLite backend, Ollama-only AI, single user.
- **Cloud mode**: same React app talks to Supabase (Postgres + Auth) for CRUD and calls LLM providers **directly from the browser** with user-supplied API keys (BYOK). No backend AI inference, no server-side secrets. Cloud build deploys to Netlify (`frontend/netlify.toml`, SPA fallback → `/index.html`).

## Running the App

Start scripts auto-install deps on first run and launch both servers (both bind `0.0.0.0`):
```bash
./start.sh        # Linux/macOS
start.bat         # Windows
```

Manual (two terminals):
```bash
cd backend && node server.js      # http://localhost:3000
cd frontend && npm run dev         # http://localhost:5173
```

Frontend production build: `cd frontend && npm run build` → `dist/`.

## Dual-Mode Switching

- `frontend/src/utils/mode.js` exports `IS_CLOUD` / `IS_LOCAL` from `import.meta.env.VITE_MILO_MODE`.
- API clients (`movieApi.js`, `tvApi.js`, `podcastApi.js`, `assistantApi.js`, `tasteApi.js`, `feedbackApi.js`) are **switchers**: `await import('./cloud')` if `IS_CLOUD`, else the `./*.local.js` variant (relative `/api` fetches).
- `cloud.js` calls Supabase directly from the browser; `*.local.js` hit the Express backend through the Vite `/api` proxy (`vite.config.js`: `/api` → `http://localhost:3000`).
- `friendsApi.js` / `FriendsContext.jsx` are **cloud-only** (profiles, friend requests, friends' libraries) — no `.local.js` variant.
- In cloud mode the backend is entirely unused; `AuthGate.jsx` wraps the app with Supabase email/password auth (a no-op in local mode).

## Database — Local Mode (SQLite)

`movies.db` in repo root, auto-created + auto-migrated on backend startup (`backend/database.js`; gitignored).

`movies` columns: `id, title, rating (REAL 1-10), genre, date_watched, notes, director, release_year, type ('movie'|'tv'|'podcast'), num_seasons, total_episodes, host, publisher, episodes_heard, artwork_url, status (default 'watched'), created_at`. The `type` column distinguishes the three content types in one table; the four podcast columns are nullable and unused by movies/TV. Podcasts reuse `status='watched'` / `'to_watch'` — only the UI labels differ ("Listened" / "To Listen", from `CONTENT_TYPES.podcast.verb`). Changing the stored values would drop podcasts out of every AI feature, which all filter on `status='watched'`.

**Content-type registry**: `frontend/src/utils/contentTypes.js` is the single source of truth for the three types — `CONTENT_TYPES`, `CONTENT_TYPE_KEYS`, plus an `ACCENT` map of **complete literal Tailwind class strings** (`cyan` → neon-cyan, `magenta` → neon-magenta, `purple` → neon-purple). Never interpolate class names like `` `text-${accent}` `` — Tailwind's extractor can't see them. Accent convention: Movies = cyan, TV = magenta, Podcasts = purple.

Extra tables (also auto-created, idempotent):
- `taste_profiles` — one row per `scope` (`'all'` = unified movies+TV+podcasts); persisted AI taste profile.
- `rec_feedback` — per-title reaction to a recommendation; unique on `(normalized_title, content_type)`; feedback ∈ `interested|not_for_me|seen_it`.

`migrateDatabase()` detects missing columns / NOT NULL constraints and rebuilds via a `movies_new` copy + rename; the podcast columns are added via a guarded additive `ALTER TABLE` path instead. `recoverTvTypes()` (rows with seasons/episodes but `type='movie'` → `'tv'`) is guarded to skip rows with any podcast column set, so a podcast row can never be silently converted to TV on startup.

**`status` matters for AI**: the assistant and recommender treat only `status='watched'` rows as context — watchlist items are excluded.

## Database — Cloud Mode (Supabase)

Postgres with RLS scoping every row to `auth.uid() = user_id`. Schema spans `supabase/migrations/0001_init.sql` … `0009_podcasts.sql` (movies, profiles, friends, taste_profiles, rec_feedback; `0009` adds the four podcast columns).

## AI — Local Mode (Ollama)

`backend/ollama-recommender.js` calls `OLLAMA_URL` (default `http://localhost:11434`).
- Models listed from `GET /api/ollama/models` (embedding models filtered out via `/embed/i`). **No hardcoded default** — the user picks a model in the UI per request. If `OLLAMA_MODEL` is unset and the request omits a model, the recommender errors loudly.
- Cache key: `${contentType}:${type}:${model}:${sig}` where `sig = "${count}:${hash(id|rating|status)}"`. Because `sig` hashes over id+rating+status, **editing a rating or status invalidates the cache** — adds/removes aren't the only trigger. TTL 24h, in-memory.
- On any Ollama failure (down, model not pulled) the route returns `source: 'simple'` with the raw error in `aiErrorMessage` for the frontend to display.
- `assistant.js` is a chat assistant over Ollama; `taste-analyzer.js` builds the persisted taste profile. Both filter to `status='watched'`.

## AI — Cloud Mode (BYOK)

Providers called **directly from the browser** with user-supplied keys; keys live in `localStorage` under `milo.aiSettings.v1` (`frontend/src/utils/aiSettings.js`) and are **never sent to any Milo-controlled server** — with one narrow exception, below.

15 providers in `frontend/src/ai/providers/`: anthropic, cerebras, custom, deepseek, fireworks, googleai, groq, mistral, ollama, openrouter, together, xai, zai, zaiCoding, plus shared `_openaiCompatible.js`. OpenRouter is the preferred one-key-many-models option.

**z.ai / z.ai Coding exception**: `api.z.ai` doesn't send CORS headers, so a direct browser `fetch()` to it is blocked (surfaces as a raw "NetworkError when attempting to fetch resource"). Those two providers set `proxied: true` in `createOpenAICompatibleProvider` (`_openaiCompatible.js`) and, in cloud mode, route through `frontend/netlify/functions/zai-proxy.js` instead of calling `api.z.ai` directly. That function forwards the request server-side to a hardcoded allowlist of z.ai endpoints — the key passes through per-request only, never logged or stored. All other providers are confirmed CORS-friendly and still call their APIs directly from the browser. Testing this locally requires `netlify dev` (not plain `vite dev`), since Vite alone doesn't serve Netlify Functions.

**60-second ceiling on the proxy**: Netlify Functions are hard-capped at 60s (streaming does not raise it), and past that the caller gets an opaque Lambda crash body that surfaced as `z.ai Coding: 502 …`. Mitigations in place: the proxy aborts upstream at 55s with a real JSON 504; `stream: true` responses are piped through unbuffered (`supportsStreaming: true` on both z.ai providers) so a truncated request still yields usable partial text; `jsonGenerationMaxTokens: 3000` instead of the 8000 default; and `thinking: {type:'disabled'}` on both JSON and assistant calls, with a one-shot retry without the field on HTTP 400 for models that refuse to disable reasoning. See `Archive_doc_update/zai-cloud-502-known-issue.md`.

## Backend Modules

- `server.js` — entry; loads `.env`, mounts `/api` routes, binds `0.0.0.0`.
- `database.js` — SQLite connection, schema init, auto-migration.
- `routes/index.js` — single large router: all CRUD + `/ollama/*`, `/recommendations`, `/assistant`, `/analytics`, import endpoints. `/api/movies` accepts a `type` query param (all three types work); `/api/tv` is a TV-only legacy alias. There is deliberately no `/api/podcasts` — podcasts reuse `/api/movies?type=podcast`.
- `ollama-recommender.js` — recommendations + 24h cache. `assistant.js` — chat assistant. `taste-analyzer.js` — taste profile. All three handle all three content types.
- `db-importer.js` / `letterboxd-importer.js` — CSV/SQLite/Letterboxd import via `multer` uploads to `backend/uploads/`.

Frontend state: `MovieContext.jsx`, `TVSeriesContext.jsx`, `PodcastContext.jsx`, `FriendsContext.jsx` (React Context, consumed via hooks rather than fetching directly).

**Podcast metadata**: `frontend/src/api/podcastLookup.js` queries the iTunes Search API (`https://itunes.apple.com/search?media=podcast=…`) **directly from the browser** — CORS is confirmed (`access-control-allow-origin: *`), no proxy needed. Used for artwork + autofill in the Add modal; the feature degrades to plain manual entry on any failure. `release_year` is deliberately not autofilled (iTunes `releaseDate` is the latest-episode date, not the show's debut).

**Genres**: `frontend/src/utils/genreColors.js` splits `SCREEN_GENRE_COLORS` (film/TV) from `PODCAST_GENRE_COLORS` (iTunes `primaryGenreName` strings); `GenreFilter` takes a `genres` prop so each section filters its own list. Unknown genres fall back gracefully.

## Import / Migration

- Letterboxd import: parsed client-side in `frontend/src/api/letterboxdClient.js` (local → backend API; cloud → direct Supabase inserts).
- Migrate local SQLite → Supabase: `node scripts/migrate-sqlite-to-supabase.js --user-id <auth-uid>` (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env).

## Key Configuration

| Setting | Default | Override |
|---|---|---|
| Backend port | 3000 | `PORT` env var |
| Frontend port | 5173 | `frontend/vite.config.js` |
| Ollama URL | `http://localhost:11434` | `OLLAMA_URL` env var |
| Ollama model | _none — picked in UI per request_ | `OLLAMA_MODEL` env var (optional) |
| Ollama generate timeout | 480000 ms (8 min) | `OLLAMA_TIMEOUT_MS` env var |
| Ollama models endpoint timeout | 30000 ms | `OLLAMA_MODELS_TIMEOUT_MS` env var |
| Ollama status endpoint timeout | 15000 ms | `OLLAMA_STATUS_TIMEOUT_MS` env var |
| Milo mode | `local` | `VITE_MILO_MODE=cloud` |
| Supabase URL (cloud only) | _none_ | `VITE_SUPABASE_URL` env var |
| Supabase anon key (cloud only) | _none_ | `VITE_SUPABASE_ANON_KEY` env var |

## No Verification Commands

No tests, linting, type-checking, or CI are configured. `backend` `npm test` just errors. **Do not run `npm test`, `npm run lint`, or `tsc`** — they will fail or no-op.
