# Project Structure

Dual-mode monorepo — one React frontend, two data/AI backends selected at build time:
- `backend/` - Node.js + Express 5 + SQLite (port 3000, **local mode only** — unused in cloud)
- `frontend/` - React 18 + Vite 5 + Tailwind, react-router-dom v7 (port 5173)
- `movies.db` - SQLite DB, auto-created in repo root (local mode only; gitignored)
- `supabase/migrations/` - 8 SQL migrations for cloud Postgres
- Cloud build deploys to Netlify (`frontend/netlify.toml`, SPA fallback → `/index.html`)

# Startup

Start scripts auto-install deps on first run and launch both servers:
- Linux/macOS: `./start.sh`
- Windows: `start.bat`

Manual (two terminals):
- `cd backend && node server.js`
- `cd frontend && npm run dev`

Both servers bind `0.0.0.0`. Frontend build: `cd frontend && npm run build` → `dist/`.

# Dual-Mode Switching

Mode is a **build-time** flag: `VITE_MILO_MODE=local` (default) | `cloud`.

- `frontend/src/utils/mode.js` exports `IS_CLOUD` / `IS_LOCAL` from `import.meta.env.VITE_MILO_MODE`.
- API clients (`movieApi.js`, `tvApi.js`, `assistantApi.js`, `tasteApi.js`, `feedbackApi.js`) are **switchers**: top-level `await import('./cloud')` if `IS_CLOUD`, else `./*.local.js` (relative `/api` fetches).
- `cloud.js` calls Supabase directly from the browser; `*.local.js` hit the Express backend via the Vite `/api` proxy (`vite.config.js`: `/api` → `http://localhost:3000`).
- `friendsApi.js` / `FriendsContext.jsx` are **cloud-only** (profiles, friend requests, friends' libraries) — no `.local.js` variant.
- In cloud mode the backend is entirely unused; AuthGate wraps the app with Supabase email/password auth.

# Database — Local Mode (SQLite)

Single `movies` table, created + auto-migrated on backend startup (`backend/database.js`).

`movies` columns: `id, title, rating (REAL 1-10), genre, date_watched, notes, director, release_year, type ('movie'|'tv'), num_seasons, total_episodes, status (default 'watched'), created_at`. The `type` column distinguishes movies/TV in one table.

Extra tables (also auto-created, idempotent):
- `taste_profiles` — one row per `scope` (`'all'` = unified movies+TV); persisted AI taste profile.
- `rec_feedback` — per-user reaction to a recommendation; unique on `(normalized_title, content_type)`; feedback ∈ `interested|not_for_me|seen_it`.

**Migration** (`migrateDatabase()`): detects missing columns / NOT NULL constraints and rebuilds via `movies_new` copy + rename. Also runs `recoverTvTypes()` (rows with seasons/episodes but `type='movie'` → `'tv'`).

**`status` matters for AI**: assistant and recommender treat only `status='watched'` rows as context — watchlist items are excluded.

# Database — Cloud Mode (Supabase)

Postgres with RLS scoping every row to `auth.uid() = user_id`. Schema across `supabase/migrations/0001_init.sql` … `0008_email_for_username.sql` (movies, profiles, friends, taste_profiles, rec_feedback).

# AI — Local Mode (Ollama)

`backend/ollama-recommender.js` calls `OLLAMA_URL` (default `http://localhost:11434`).
- Models listed from `GET /api/ollama/models` (embedding models filtered out via `/embed/i`); **no hardcoded default** — user picks a model in the UI per request. If `OLLAMA_MODEL` is unset and the request omits one, the recommender errors.
- **Cache key: `${contentType}:${type}:${model}:${sig}`** where `sig = librarySignature = "${count}:${hash(id|rating|status)}"`. Because `sig` is hashed over id+rating+status, **editing a rating or status invalidates the cache** — adds/removes are not the only trigger. TTL 24h (in-memory).
- On any Ollama failure (down, model not pulled) the route returns `source: 'simple'` with the raw error in `aiErrorMessage`.

Ollama env (in `backend/.env`, all have defaults): `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS` (480000), `OLLAMA_MODELS_TIMEOUT_MS` (30000), `OLLAMA_STATUS_TIMEOUT_MS` (15000).

# AI — Cloud Mode (BYOK)

Providers called **directly from the browser** with user-supplied keys; keys live in `localStorage` under `milo.aiSettings.v1` (`frontend/src/utils/aiSettings.js`) and are **never sent to any Milo-controlled server**.

15 providers in `frontend/src/ai/providers/`: anthropic, cerebras, custom, deepseek, fireworks, googleai, groq, mistral, ollama, openrouter, together, xai, zai, zaiCoding, plus shared `_openaiCompatible.js`. (OpenRouter is the preferred one-key-many-models option.)

# Backend Modules

- `server.js` — entry; loads `.env`, mounts `/api` routes, binds `0.0.0.0`.
- `database.js` — SQLite conn, schema init, auto-migration.
- `routes/index.js` — single ~920-line router: all CRUD + `/ollama/*`, `/recommendations`, `/assistant`, `/analytics`, import endpoints.
- `ollama-recommender.js` — recommendations + 24h cache.
- `assistant.js` — chat assistant over Ollama (filters to `status='watched'`).
- `taste-analyzer.js` — builds the persisted taste profile.
- `db-importer.js` / `letterboxd-importer.js` — CSV/SQLite/Letterboxd import via `multer` uploads to `backend/uploads/`.

Frontend state: `MovieContext.jsx`, `TVSeriesContext.jsx`, `FriendsContext.jsx` (React Context, consumed via hooks).

# Cloud Mode Build

Required build-time env (see `frontend/.env.example`):
- `VITE_MILO_MODE=cloud`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

# Import / Migration

- Letterboxd import: parsed client-side in `frontend/src/api/letterboxdClient.js` (local → backend API; cloud → direct Supabase inserts).
- Migrate local SQLite → Supabase: `node scripts/migrate-sqlite-to-supabase.js --user-id <auth-uid>` (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env).

# No Verification Commands

No tests, linting, type-checking, or CI are configured. `backend` `npm test` just errors. **Do not run `npm test`, `npm run lint`, or `tsc`** — they will fail or no-op.
