# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> A parallel `AGENTS.md` covers the same ground in more detail; keep the two in sync when either changes.
> `README.md` predates cloud mode and the iOS app — it documents local mode only. Don't trust it as a spec.
> Visual and UX intent lives in `DESIGN.md` — the accent registry rules, motion constraints that WKWebView enforces, and the surfaces that get disproportionate care. Read it before building any new UI.

## Project Overview

**MILO** — a movie, TV, podcast, and book tracking dashboard. One React frontend, two data/AI backends selected at **build time** via `VITE_MILO_MODE=local|cloud` (default `local`), shipped to three targets:

- **Local mode**: React frontend + Express 5 / SQLite backend, Ollama-only AI, single user.
- **Cloud mode**: same React app talks to Supabase (Postgres + Auth) for CRUD and calls LLM providers **directly from the browser** with user-supplied API keys (BYOK). No backend AI inference, no server-side secrets. Cloud build deploys to Netlify (`frontend/netlify.toml`, SPA fallback → `/index.html`).
- **iOS app**: the cloud-mode build wrapped in Capacitor (`frontend/ios/`), shipped to TestFlight / App Store.

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

Cloud-mode features that depend on Netlify Functions (the z.ai proxy) need `netlify dev` instead of `npm run dev` — plain Vite doesn't serve `frontend/netlify/functions/`.

## Dual-Mode Switching

- `frontend/src/utils/mode.js` exports `IS_CLOUD` / `IS_LOCAL` from `import.meta.env.VITE_MILO_MODE`.
- API clients (`movieApi.js`, `tvApi.js`, `podcastApi.js`, `bookApi.js`, `assistantApi.js`, `tasteApi.js`, `feedbackApi.js`) are **switchers**: `await import('./cloud')` if `IS_CLOUD`, else the `./*.local.js` variant (relative `/api` fetches).
- `cloud.js` calls Supabase directly from the browser; `*.local.js` hit the Express backend through the Vite `/api` proxy (`vite.config.js`: `/api` → `http://localhost:3000`).
- `friendsApi.js` / `FriendsContext.jsx` are **cloud-only** (profiles, friend requests, friends' libraries) — no `.local.js` variant.
- In cloud mode the backend is entirely unused; `AuthGate.jsx` wraps the app with Supabase email/password auth (a no-op in local mode).

## Frontend Structure & Routing

`App.jsx` splits into a public `/landing` route and `GatedApp` (everything else, wrapped in `AuthGate` + the four content providers). `/friends` and `/friends/:friendId` are mounted only when `IS_CLOUD`. `MiloAssistantFab` renders globally inside the gate.

Components live in **feature subdirectories**: `components/movies/`, `tv/`, `podcasts/`, `books/`, `friends/`, `timeline/`, `settings/`, `recommendations/`, and `shared/`.

Only two files remain directly in `frontend/src/components/`: `AuthGate.jsx` (the cloud-mode auth wrapper) and `LetterboxdImportModal.jsx` (used by `settings/DataSection.jsx`). Everything else belongs in a feature subdirectory — put new components there rather than at the root. Eight unreferenced leftovers that had shadowed the real `movies/` and `shared/` versions were deleted; if you see one reappear in an old diff or branch, it is not the live copy.

**Sign-in backdrop**: `frontend/src/utils/neonHorizon.js` draws the synthwave grid + starfield on a `<canvas>` (wrapper: `components/shared/NeonHorizon.jsx`), used by `AuthGate`, `AppLockGate`, and the `/landing` hero. It is the app's only `requestAnimationFrame`/canvas code. It replaced a CSS perspective grid that iOS smeared into a colour wash — WebKit rasterises a 3D-transformed layer once into a fixed backing store and then lets the perspective magnify that bitmap, so the near hairlines were a stretched cache. **Do not reintroduce a CSS-3D-transformed fine-line texture.** The DPR cap of 2 and the 30fps native idle cap are deliberate (see commit `bf98bb8` on WKWebView main-thread starvation); lane density is derived from viewport width so it survives rotation. `WARP_MS` is exported and shared with AuthGate's sign-in hand-off timer — don't fork the constant.

**Design tokens**: the neon palette lives in `frontend/tailwind.config.js` (`neon-cyan` `#00d4ff`, `neon-magenta` `#ff006e`, `neon-purple` `#8338ec`, `neon-orange` `#ff7a18`, `neon-yellow`, plus `bg-primary/secondary/tertiary`) and `frontend/src/index.css` (`.glass`, `.neon-text-*`, gradient body). `darkMode: 'class'`, but the app is dark-only in practice.

## Database — Local Mode (SQLite)

`movies.db` in repo root, auto-created + auto-migrated on backend startup (`backend/database.js`; gitignored).

`movies` columns: `id, title, rating (REAL 1-10), genre, date_watched, notes, director, release_year, type ('movie'|'tv'|'podcast'|'book'), num_seasons, total_episodes, host, publisher, episodes_heard, artwork_url, author, page_count, pages_read, status (default 'watched'), created_at`. The `type` column distinguishes the four content types in one table; the four podcast columns and three book columns (`author`, `page_count`, `pages_read`) are nullable and unused by other types. Books also reuse `publisher`, `artwork_url` (cover), and `release_year` (first published). Podcasts and books reuse `status='watched'` / `'to_watch'` — only the UI labels differ ("Listened" / "To Listen", "Read" / "To Read", from `CONTENT_TYPES[type].verb`). Changing the stored values would drop podcasts and books out of every AI feature, which all filter on `status='watched'`.

**Content-type registry**: `frontend/src/utils/contentTypes.js` is the single source of truth for the four types — `CONTENT_TYPES`, `CONTENT_TYPE_KEYS`, plus an `ACCENT` map of **complete literal Tailwind class strings** (`cyan` → neon-cyan, `magenta` → neon-magenta, `purple` → neon-purple, `orange` → neon-orange). Never interpolate class names like `` `text-${accent}` `` — Tailwind's extractor can't see them. Accent convention: Movies = cyan, TV = magenta, Podcasts = purple, Books = orange.

Extra tables (also auto-created, idempotent):
- `taste_profiles` — one row per `scope` (`'all'` = unified movies+TV+podcasts); persisted AI taste profile.
- `rec_feedback` — per-title reaction to a recommendation; unique on `(normalized_title, content_type)`; feedback ∈ `interested|not_for_me|seen_it`.

`migrateDatabase()` detects missing columns / NOT NULL constraints and rebuilds via a `movies_new` copy + rename; the podcast and book columns are added via a guarded additive `ALTER TABLE` path instead (`ensureAdditiveColumns`). `recoverTvTypes()` (rows with seasons/episodes but `type='movie'` → `'tv'`) is guarded to skip rows with any podcast or book column set, so a podcast or book row can never be silently converted to TV on startup.

**`status` matters for AI**: the assistant and recommender treat only `status='watched'` rows as context — watchlist items are excluded.

## Database — Cloud Mode (Supabase)

Postgres with RLS scoping every row to `auth.uid() = user_id`. Schema spans `supabase/migrations/0001_init.sql` … `0010_delete_account.sql` (movies, profiles, friends, taste_profiles, rec_feedback; `0009` adds the four podcast columns).

`0010` adds the `delete_my_account(p_confirm text)` security-definer RPC — self-service account deletion required by App Store Guideline 5.1.1(v). supabase-js has no client-side "delete my own user" call (that needs the service-role key, which must never ship), so the RPC deletes `auth.users` for `auth.uid()` only, cascading through every MILO table. It refuses unless the client passes the literal string `'DELETE'`. Called from `components/settings/DataSection.jsx`.

## iOS App (Capacitor)

`frontend/ios/` is a committed Capacitor 8 Xcode project (SPM-based via `CapApp-SPM`, **no CocoaPods/Podfile**). `frontend/capacitor.config.json`: appId `com.kgthePM.milo`, appName `MILO`, `webDir: "dist"`. Signing team `4CC8W8RW2F`; `ios/ExportOptions.plist` targets `app-store-connect`.

Build flow — the iOS app is just the **cloud-mode** web build copied into the native shell:
```bash
cd frontend
npm run build          # requires VITE_MILO_MODE=cloud + Supabase vars in .env.local
npx cap sync ios       # copies dist/ → ios/App/App/public and updates plugins
npx cap open ios       # then archive/upload from Xcode
```
Never hand-edit `ios/App/App/public/` — `cap sync` overwrites it wholesale.

**`IS_NATIVE`** (`frontend/src/utils/native.js`) is computed synchronously from `window.location.protocol` (`capacitor:` / `ionic:` / `file:`). Every `@capacitor/*` API is **dynamically imported** inside that module so the plugin modules never enter a plain-web bundle graph at module-eval time — preserve that pattern when adding native code.

Native-only branches currently in place:
- **Session storage** (`utils/supabase.js`): `localStorage` inside a WKWebView can be purged by iOS under storage pressure, silently logging users out. On native, supabase-js is given an async storage adapter backed by `@capacitor/preferences` (UserDefaults). `detectSessionInUrl` is also disabled on native — confirmation links go through the deep-link listener instead.
- **Routing** (`App.jsx`): `/landing` redirects to `/` on native, so marketing / Download / clone-the-repo CTAs are structurally unreachable inside the app.
- **z.ai proxy URL** (`ai/providers/_openaiCompatible.js`): the page origin is `capacitor://localhost`, so the relative `/.netlify/functions/zai-proxy` path resolves to nothing. `resolveProxyUrl()` falls back to the absolute deployed URL; `VITE_ZAI_PROXY_URL` overrides both cases.
- **Safe areas**: `index.html` sets `viewport-fit=cover`; `index.css` sets `overscroll-behavior: none` to kill rubber-band scroll, and applies the insets via the `.safe-area` / `.safe-area-plus` classes that each page shell carries — **not** on `html, body`, which double-applied them and made every page taller than the viewport (see the comment at `index.css:32`).

`ios/App/App/PrivacyInfo.xcprivacy` is the required privacy manifest.

## AI — Local Mode (Ollama)

`backend/ollama-recommender.js` calls `OLLAMA_URL` (default `http://localhost:11434`).
- Models listed from `GET /api/ollama/models` (embedding models filtered out via `/embed/i`). **No hardcoded default** — the user picks a model in the UI per request. If `OLLAMA_MODEL` is unset and the request omits a model, the recommender errors loudly.
- Cache key: `${contentType}:${type}:${model}:${sig}` where `sig = "${count}:${hash(id|rating|status)}"`. Because `sig` hashes over id+rating+status, **editing a rating or status invalidates the cache** — adds/removes aren't the only trigger. TTL 24h, in-memory.
- On any Ollama failure (down, model not pulled) the route returns `source: 'simple'` with the raw error in `aiErrorMessage` for the frontend to display.
- `assistant.js` is a chat assistant over Ollama; `taste-analyzer.js` builds the persisted taste profile. Both filter to `status='watched'`.

## AI — Cloud Mode (BYOK)

Providers called **directly from the browser** with user-supplied keys; keys live in `localStorage` under `milo.aiSettings.v1` (`frontend/src/utils/aiSettings.js`) and are **never sent to any Milo-controlled server** — with one narrow exception, below.

14 providers in `frontend/src/ai/providers/` (anthropic, cerebras, custom, deepseek, fireworks, googleai, groq, mistral, ollama, openrouter, together, xai, zai, zaiCoding) plus shared `_openaiCompatible.js`. OpenRouter is the preferred one-key-many-models option.

**z.ai / z.ai Coding exception**: `api.z.ai` doesn't send CORS headers, so a direct browser `fetch()` to it is blocked (surfaces as a raw "NetworkError when attempting to fetch resource"). Those two providers set `proxied: true` in `createOpenAICompatibleProvider` (`_openaiCompatible.js`) and, in cloud mode, route through `frontend/netlify/functions/zai-proxy.js` instead of calling `api.z.ai` directly. That function forwards the request server-side to a hardcoded allowlist of z.ai endpoints — the key passes through per-request only, never logged or stored. All other providers are confirmed CORS-friendly and still call their APIs directly from the browser. Testing this locally requires `netlify dev` (not plain `vite dev`), since Vite alone doesn't serve Netlify Functions.

**60-second ceiling on the proxy**: Netlify Functions are hard-capped at 60s (streaming does not raise it), and past that the caller gets an opaque Lambda crash body that surfaced as `z.ai Coding: 502 …`. Mitigations in place: the proxy aborts upstream at 55s with a real JSON 504; the client budget (`CLIENT_TIMEOUT_MS`) sits just under at 58s so whichever layer gives up first produces a real message; `stream: true` responses are piped through unbuffered (`supportsStreaming: true` on both z.ai providers) so a truncated request still yields usable partial text; `jsonGenerationMaxTokens: 3000` instead of the 8000 default; and `thinking: {type:'disabled'}` on both JSON and assistant calls, with a one-shot retry without the field on HTTP 400 for models that refuse to disable reasoning. See `Archive_doc_update/zai-cloud-502-known-issue.md`.

## Backend Modules

- `server.js` — entry; loads `.env`, mounts `/api` routes, binds `0.0.0.0`.
- `database.js` — SQLite connection, schema init, auto-migration.
- `routes/index.js` — single large router (~960 lines): all CRUD + `/ollama/*`, `/recommendations`, `/assistant`, `/analytics`, import endpoints. `/api/movies` accepts a `type` query param (all four types work); `/api/tv` is a TV-only legacy alias. There is deliberately no `/api/podcasts` or `/api/books` — both reuse `/api/movies?type=…`.
- `ollama-recommender.js` — recommendations + 24h cache. `assistant.js` — chat assistant. `taste-analyzer.js` — taste profile. All three handle all four content types.
- `db-importer.js` / `letterboxd-importer.js` — CSV/SQLite/Letterboxd import via `multer` uploads to `backend/uploads/`.

Frontend state: `MovieContext.jsx`, `TVSeriesContext.jsx`, `PodcastContext.jsx`, `BookContext.jsx`, `FriendsContext.jsx` (React Context, consumed via hooks rather than fetching directly).

**Podcast metadata**: `frontend/src/api/podcastLookup.js` queries the iTunes Search API (`https://itunes.apple.com/search?media=podcast=…`) **directly from the browser** — CORS is confirmed (`access-control-allow-origin: *`), no proxy needed. Used for artwork + autofill in the Add modal; the feature degrades to plain manual entry on any failure. `release_year` is deliberately not autofilled (iTunes `releaseDate` is the latest-episode date, not the show's debut).

**Book metadata**: `frontend/src/api/bookLookup.js` queries Open Library (`https://openlibrary.org/search.json`) **directly from the browser**. It needs no key, is CORS-open, and needs no proxy. Covers come from `covers.openlibrary.org/b/id/{cover_i}-{S|L}.jpg`; always look covers up by cover ID, because ISBN/OLID cover lookups are rate-limited per IP. `first_publish_year` is the real debut, so unlike podcasts `release_year` **is** autofilled. Open Library `subject` lists are mapped onto `BOOK_GENRE_LIST` by ordered rules (`mapSubjectsToGenre`), and anything unmapped leaves the user's genre alone. Credited in the Credits block of `settings/DataSection.jsx`, which now always renders (the TMDB line inside it stays conditional).

**Movie/TV lookup**: `frontend/src/api/tmdbLookup.js` queries TMDB directly from the browser (CORS-friendly; TMDB permits client-side keys) using `VITE_TMDB_TOKEN` (the v4 API Read Access Token). When the token is unset, `TMDB_ENABLED` is false and the Find box is not rendered. Picking a result fetches details (movies: director, genre, poster; TV: seasons, episodes, genre, poster) via `getMovieDetails` / `getTVDetails`, which never throw and fall back to title + year. TMDB genres are mapped onto MILO's fixed movie/TV genre list, and anything unmappable leaves the user's choice alone. Posters are saved to `artwork_url`. The UI for all four lookups is `components/shared/TitleSearch.jsx`, wrapped by `PodcastSearch`, `books/BookSearch`, `movies/MovieSearch`, and `tv/TVSeriesSearch`. TMDB's terms require attribution (the Credits block in `settings/DataSection.jsx`) and cover non-commercial use only; MILO is free, so this is fine.

**Genres**: `frontend/src/utils/genreColors.js` splits `SCREEN_GENRE_COLORS` (film/TV) from `PODCAST_GENRE_COLORS` (iTunes `primaryGenreName` strings); `GenreFilter` takes a `genres` prop so each section filters its own list. Unknown genres fall back gracefully. Users can override colors per genre via `utils/userPrefs.js` (`milo.userPrefs.v1` in `localStorage`, with a subscribe/notify hook).

## Import / Migration

- Letterboxd import: parsed client-side in `frontend/src/api/letterboxdClient.js` (local → backend API; cloud → direct Supabase inserts).
- Goodreads import: `components/books/GoodreadsImportModal.jsx` (Settings → Data, and the empty Books library) + `frontend/src/api/goodreadsClient.js`, parsed client-side in both modes. Shelves map read → `watched`, to-read / currently-reading → `to_watch`; stars ×2; custom exclusive shelves and read-but-unrated rows are skipped and counted (MILO requires a rating on `watched`). Covers are resolved at import time in two batched Open Library passes — `lookupByIsbns` (40 ISBNs per `isbn:(… OR …)` query), then `lookupByTitles` for rows with no ISBN (Kindle editions) — never one request per book. Written via `bookApi.importBooks`: chunked bulk insert in cloud, sequential POSTs in local (no bulk backend route).
- Migrate local SQLite → Supabase: `node scripts/migrate-sqlite-to-supabase.js --user-id <auth-uid>` (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env).

## Marketing Site

`MILO_Landing/milo-landing/` is a **separate, standalone static site** (plain `index.html` + screenshots, CDN Tailwind, no build step, its own `netlify.toml` with a CSP header). It is not part of the frontend build and shares no code with it. The in-app `/landing` route (`pages/LandingPage.jsx`) is a different, React-rendered page.

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
| z.ai proxy URL | relative on web, deployed URL on iOS | `VITE_ZAI_PROXY_URL` env var |
| TMDB token (movie/TV lookup) | _none — lookup hidden_ | `VITE_TMDB_TOKEN` env var |

## No Verification Commands

No tests, linting, type-checking, or CI are configured. `backend` `npm test` just errors. **Do not run `npm test`, `npm run lint`, or `tsc`** — they will fail or no-op. The closest thing to a check is `cd frontend && npm run build`, which will catch import/syntax errors.
