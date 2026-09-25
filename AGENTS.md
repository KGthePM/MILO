# Project Structure

> Visual and UX intent lives in `DESIGN.md` — the accent registry rules, motion constraints that WKWebView enforces, and the surfaces that get disproportionate care. Read it before building any new UI.

Dual-mode monorepo — one React frontend, two data/AI backends selected at build time, three delivery targets:
- `backend/` - Node.js + Express 5 + SQLite (port 3000, **local mode only** — unused in cloud)
- `frontend/` - React 18 + Vite 5 + Tailwind, react-router-dom v7 (port 5173)
- `frontend/ios/` - Capacitor 8 Xcode project wrapping the cloud-mode web build (TestFlight / App Store)
- `frontend/netlify/functions/` - the single serverless function (`zai-proxy.js`); cloud mode only
- `movies.db` - SQLite DB, auto-created in repo root (local mode only; gitignored)
- `supabase/migrations/` - 10 SQL migrations for cloud Postgres
- `MILO_Landing/milo-landing/` - standalone static marketing site; **not** part of the frontend build
- `scripts/` - one-off Node scripts (SQLite → Supabase migration)
- `Archive_doc_update/` - design/plan notes kept for context (not live docs)
- Cloud build deploys to Netlify (`frontend/netlify.toml`, SPA fallback → `/index.html`)

`README.md` predates cloud mode and the iOS app — it documents local mode only. Don't trust it as a spec.
`CLAUDE.md` is the condensed sibling of this file; keep the two in sync when either changes.

# Startup

Start scripts auto-install deps on first run and launch both servers:
- Linux/macOS: `./start.sh`
- Windows: `start.bat`

Manual (two terminals):
- `cd backend && node server.js`
- `cd frontend && npm run dev`

Both servers bind `0.0.0.0`. Frontend build: `cd frontend && npm run build` → `dist/`.

Cloud-mode work that touches the z.ai proxy needs `netlify dev` rather than `npm run dev` — plain Vite does not serve `frontend/netlify/functions/`.

# Dual-Mode Switching

Mode is a **build-time** flag: `VITE_MILO_MODE=local` (default) | `cloud`.

- `frontend/src/utils/mode.js` exports `IS_CLOUD` / `IS_LOCAL` from `import.meta.env.VITE_MILO_MODE`.
- API clients (`movieApi.js`, `tvApi.js`, `podcastApi.js`, `bookApi.js`, `assistantApi.js`, `tasteApi.js`, `feedbackApi.js`) are **switchers**: top-level `await import('./cloud')` if `IS_CLOUD`, else `./*.local.js` (relative `/api` fetches).
- `cloud.js` calls Supabase directly from the browser; `*.local.js` hit the Express backend via the Vite `/api` proxy (`vite.config.js`: `/api` → `http://localhost:3000`).
- `friendsApi.js` / `FriendsContext.jsx` are **cloud-only** (profiles, friend requests, friends' libraries) — no `.local.js` variant.
- In cloud mode the backend is entirely unused; AuthGate wraps the app with Supabase email/password auth **plus Sign in with Apple** (`utils/appleAuth.js`: native sheet via `@capgo/capacitor-social-login` → `signInWithIdToken`; web via `signInWithOAuth` redirect). Password reset: "Forgot password?" on the sign-in card → `resetPasswordForEmail` → recovery link lands on the public `/reset-password` route (`pages/ResetPasswordPage.jsx`).

# Frontend Structure & Routing

`App.jsx` splits the tree in two:
- `/landing` — public, rendered **outside** `AuthGate` (`pages/LandingPage.jsx`). On native it redirects to `/`, so marketing / Download / clone-the-repo CTAs are structurally unreachable inside the iOS app.
- `/*` → `GatedApp` — wrapped in `AuthGate` and the four content providers (`MovieProvider` → `TVSeriesProvider` → `PodcastProvider` → `BookProvider`), with `MiloAssistantFab` rendered globally inside the gate.

Routes: `/` and `/movies` → `MoviesPage`, `/tv`, `/podcasts`, `/timeline`, `/settings`, plus `/friends` and `/friends/:friendId` which are **mounted only when `IS_CLOUD`**.

Components live in feature subdirectories: `components/movies/`, `tv/`, `podcasts/`, `books/`, `friends/`, `timeline/`, `settings/`, `recommendations/`, and `shared/`.

Only two files remain directly in `frontend/src/components/`: `AuthGate.jsx` (cloud-mode auth wrapper, used by `App.jsx`) and `LetterboxdImportModal.jsx` (used by `settings/DataSection.jsx`). Everything else lives in a feature subdirectory — put new components there rather than at the root.

Eight unreferenced files that used to sit at that root were deleted (`AddMovieModal`, `EditMovieModal`, `GenreFilter`, `MovieCard`, `Recommendations`, `SearchFilter`, `Stats`, `Navigation`). The first seven shadowed the real implementations in `components/movies/` and `components/shared/`; `Navigation.jsx` was a pre-router three-tab bar superseded by `shared/FloatingCommandBar.jsx` and the per-page tab rows. If one turns up in an old branch or diff, it is not the live copy.

**Sign-in backdrop**: `frontend/src/utils/neonHorizon.js` draws the synthwave grid + starfield on a `<canvas>` (wrapper: `components/shared/NeonHorizon.jsx`), used by `AuthGate`, `AppLockGate`, and the `/landing` hero. It is the app's only `requestAnimationFrame`/canvas code. It replaced a CSS perspective grid that iOS smeared into a colour wash — WebKit rasterises a 3D-transformed layer once into a fixed backing store and then lets the perspective magnify that bitmap, so the near hairlines were a stretched cache. **Do not reintroduce a CSS-3D-transformed fine-line texture.** The DPR cap of 2 and the 30fps native idle cap are deliberate (WKWebView main-thread starvation); lane density derives from viewport width so it survives rotation. `WARP_MS` is exported and shared with AuthGate's sign-in hand-off timer — don't fork the constant.

**Design tokens**: `frontend/tailwind.config.js` defines the neon palette (`neon-cyan` `#00d4ff`, `neon-magenta` `#ff006e`, `neon-purple` `#8338ec`, `neon-orange` `#ff7a18`, `neon-yellow` `#ffbe0b`, `bg-primary/secondary/tertiary`) and matching `boxShadow` entries. `frontend/src/index.css` holds `.glass`, `.neon-text-{cyan,magenta,purple,orange}`, `.gradient-hyphen`, and the gradient body background. `darkMode: 'class'` is set but the app is dark-only in practice.

# Database — Local Mode (SQLite)

Single `movies` table, created + auto-migrated on backend startup (`backend/database.js`).

`movies` columns: `id, title, rating (REAL 1-10), genre, date_watched, notes, director, release_year, type ('movie'|'tv'|'podcast'|'book'), num_seasons, total_episodes, host, publisher, episodes_heard, artwork_url, author, page_count, pages_read, status (default 'watched'), created_at`. The `type` column distinguishes the four content types in one table; the four podcast columns and three book columns (`author`, `page_count`, `pages_read`) are nullable and unused by other types. Books also reuse `publisher`, `artwork_url` (cover), and `release_year` (first published). Podcasts and books reuse `status='watched'` / `'to_watch'` — only UI labels differ ("Listened" / "To Listen", "Read" / "To Read").

**Content-type registry**: `frontend/src/utils/contentTypes.js` — `CONTENT_TYPES`, `CONTENT_TYPE_KEYS`, and `ACCENT` (complete literal Tailwind class strings; Movies = cyan, TV = magenta, Podcasts = purple). Never interpolate Tailwind class names — the JIT extractor can't see dynamic strings.

Extra tables (also auto-created, idempotent):
- `taste_profiles` — one row per `scope` (`'all'` = unified movies+TV+podcasts); persisted AI taste profile.
- `rec_feedback` — per-user reaction to a recommendation; unique on `(normalized_title, content_type)`; feedback ∈ `interested|not_for_me|seen_it`.

**Migration** (`migrateDatabase()`): detects missing columns / NOT NULL constraints and rebuilds via `movies_new` copy + rename; podcast and book columns go through a guarded additive `ALTER TABLE` path (`ensureAdditiveColumns`). `recoverTvTypes()` (rows with seasons/episodes but `type='movie'` → `'tv'`) skips rows with any podcast or book column set, so podcast and book rows survive startup.

**`status` matters for AI**: assistant and recommender treat only `status='watched'` rows as context — watchlist items are excluded.

# Database — Cloud Mode (Supabase)

Postgres with RLS scoping every row to `auth.uid() = user_id`. Schema across `supabase/migrations/0001_init.sql` … `0010_delete_account.sql` (movies, profiles, friends, taste_profiles, rec_feedback; `0009` adds the four podcast columns).

**`0010_delete_account.sql`** adds `public.delete_my_account(p_confirm text)` — a `security definer` RPC providing the in-app account deletion required by App Store Guideline 5.1.1(v). supabase-js has no client-side "delete my own user" call (that lives in the admin API, which needs the service-role key we must never ship), so the function deletes the `auth.users` row for `auth.uid()` only, cascading through movies / taste_profiles / rec_feedback / profiles / friends. It returns `{ok:false, error}` unless the caller passes the literal string `'DELETE'`, so a stray call can't nuke an account. Invoked from `components/settings/DataSection.jsx` via `getSupabase().rpc('delete_my_account', { p_confirm: 'DELETE' })`.

# iOS App (Capacitor)

`frontend/ios/` is a **committed** Capacitor 8 Xcode project — SPM-based (`ios/App/CapApp-SPM`), **no CocoaPods / Podfile**. `frontend/capacitor.config.json`: appId `com.kgthePM.milo`, appName `MILO`, `webDir: "dist"`. Development team `4CC8W8RW2F` (automatic signing); `ios/ExportOptions.plist` targets `app-store-connect` with symbol upload. `ios/App/App/PrivacyInfo.xcprivacy` is the required privacy manifest; app icon + dark splash live in `ios/App/App/Assets.xcassets`.

The iOS app is nothing more than the **cloud-mode** web build inside a native shell:
```bash
cd frontend
npm run build          # needs VITE_MILO_MODE=cloud + Supabase vars in .env.local
npx cap sync ios       # copies dist/ → ios/App/App/public, refreshes plugins
npx cap open ios       # archive / upload from Xcode
```
`ios/App/App/public/` is **generated** — `cap sync` overwrites it wholesale, so never hand-edit it.

**Native plugins** (SPM, no CocoaPods): `@capacitor/app` (deep links, app state), `@capacitor/preferences` (session + app-lock storage), `@capacitor/status-bar`, `@capgo/capacitor-social-login` (Sign in with Apple native sheet), `@aparajita/capacitor-biometric-auth` (Face ID app lock).

**Sign in with Apple server config** (Supabase dashboard → Authentication → Providers → Apple): enable the provider and add `com.kgthePM.milo` to Client IDs — that's all the **native** flow needs (gotrue validates Apple's id_token against Apple's public keys; no Services ID / secret required). The **web** OAuth flow additionally needs a Services ID (`com.kgthePM.milo.web` or similar) with return URL `https://gewqxrzfpxjijqnlfilp.supabase.co/auth/v1/callback`, a Sign-in-with-Apple key (.p8), and the resulting client secret JWT pasted into the provider. Also add redirect URLs under Authentication → URL Configuration: `https://milo-movies.netlify.app/**` (site URL + reset-password redirect). `App.entitlements` carries `com.apple.developer.applesignin` (registered in the pbxproj via CODE_SIGN_ENTITLEMENTS).

**`IS_NATIVE`** (`frontend/src/utils/native.js`) is computed synchronously from `window.location.protocol` (`capacitor:`, `ionic:`, or `file:`). Every `@capacitor/*` API inside that module is **dynamically imported**, so plugin modules never enter a plain-web bundle graph at module-eval time. Preserve that pattern when adding native code.

Native-only branches currently in the codebase — all deliberate:
1. **Session storage** (`utils/supabase.js`): `localStorage` inside a WKWebView can be purged by iOS under storage pressure, silently signing users out. On native, supabase-js gets `nativeStorageAdapter()`, an async adapter backed by `@capacitor/preferences` (UserDefaults).
2. **`detectSessionInUrl: !IS_NATIVE`** (same file): at `capacitor://localhost` there is no URL to parse tokens out of; email links are handled by the deep-link listener (`utils/authDeepLinks.js`, registered in AuthGate on native; exchanges the PKCE `?code=` via `exchangeCodeForSession`, routes recovery links to `/reset-password`) instead.
3. **Routing** (`App.jsx`): `/landing` → `<Navigate to="/" />` on native; `/reset-password` is public on both platforms.
4. **Auth landing** (`components/AuthGate.jsx`): the `!IS_NATIVE && !session && pathname === '/'` guards send web visitors to the marketing page, while native users go straight to sign-in.
5. **z.ai proxy URL** (`ai/providers/_openaiCompatible.js`): the relative `/.netlify/functions/zai-proxy` path resolves to nothing at `capacitor://localhost`, so `resolveProxyUrl()` falls back to the absolute deployed endpoint (`https://milo-movies.netlify.app/...`). `VITE_ZAI_PROXY_URL` overrides both the web and native cases.
6. **Sign in with Apple** (`utils/appleAuth.js`): native uses the OS sheet + `signInWithIdToken` (no nonce — see the file header for why); web uses the OAuth redirect. The button shows on both.
7. **Face ID app lock** (`utils/appLock.js` + `components/shared/AppLockGate.jsx`): privacy curtain that re-prompts on cold start and background→foreground; toggle lives in Settings → Security (tab only rendered on native). `AppLockGate` sits inside `AuthGate` around the content providers. Requires `NSFaceIDUsageDescription` in Info.plist (set) and the setting persists via `@capacitor/preferences`.

**Safe areas**: `frontend/index.html` sets `viewport-fit=cover, user-scalable=no` plus `apple-mobile-web-app-capable`; `index.css` sets `overscroll-behavior: none` to kill rubber-band scroll, and applies the insets through the `.safe-area` / `.safe-area-plus` classes that each page shell carries — **not** on `html, body`. Padding the document elements added the insets on top of each page's own `min-height: 100vh`, so every page overflowed the viewport, and the rule matched `html` *and* `body`, applying them twice; see the comment at `index.css:32`. Dropping the shell classes leaves content under the notch / home indicator.

# AI — Local Mode (Ollama)

`backend/ollama-recommender.js` calls `OLLAMA_URL` (default `http://localhost:11434`).
- Models listed from `GET /api/ollama/models` (embedding models filtered out via `/embed/i`); **no hardcoded default** — user picks a model in the UI per request. If `OLLAMA_MODEL` is unset and the request omits one, the recommender errors.
- **Cache key: `${contentType}:${type}:${model}:${sig}`** where `sig = librarySignature = "${count}:${hash(id|rating|status)}"`. Because `sig` is hashed over id+rating+status, **editing a rating or status invalidates the cache** — adds/removes are not the only trigger. TTL 24h (in-memory).
- On any Ollama failure (down, model not pulled) the route returns `source: 'simple'` with the raw error in `aiErrorMessage`.

Ollama env (in `backend/.env`, all have defaults): `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS` (480000), `OLLAMA_MODELS_TIMEOUT_MS` (30000), `OLLAMA_STATUS_TIMEOUT_MS` (15000).

# AI — Cloud Mode (BYOK)

Providers called **directly from the browser** with user-supplied keys; keys live in `localStorage` under `milo.aiSettings.v1` (`frontend/src/utils/aiSettings.js`) and are **never sent to any Milo-controlled server** — with one narrow exception, below.

14 providers in `frontend/src/ai/providers/` (anthropic, cerebras, custom, deepseek, fireworks, googleai, groq, mistral, ollama, openrouter, together, xai, zai, zaiCoding) plus shared `_openaiCompatible.js`. (OpenRouter is the preferred one-key-many-models option.)

**z.ai / z.ai Coding exception**: `api.z.ai` doesn't send CORS headers, so a direct browser `fetch()` to it is blocked (surfaces as a raw "NetworkError when attempting to fetch resource"). Those two providers set `proxied: true` in `createOpenAICompatibleProvider` (`_openaiCompatible.js`) and, in cloud mode, route through `frontend/netlify/functions/zai-proxy.js` instead of calling `api.z.ai` directly. That function forwards the request server-side to a hardcoded allowlist of z.ai endpoints — the key passes through per-request only, never logged or stored. All other providers are confirmed CORS-friendly and still call their APIs directly from the browser. Testing this locally requires `netlify dev` (not plain `vite dev`), since Vite alone doesn't serve Netlify Functions.

**60-second ceiling on the proxy**: Netlify Functions are killed at a hard, non-configurable 60s (streaming does not raise it — only the payload cap, 6 MB → 20 MB). Past that the function returns an opaque `{"errorType":...,"errorMessage":"An unknown error has occurred"}` Lambda crash body, which surfaced as `z.ai Coding: 502 …`. Mitigations, all in place: the proxy aborts upstream at 55s and returns a real JSON 504; the client's own `CLIENT_TIMEOUT_MS` sits just under at 58s (merged with the caller's signal via `withDeadline()`), so whichever layer gives up first the user sees a real message; the proxy pipes `stream: true` responses through unbuffered (`supportsStreaming: true` on both z.ai providers) so a request cut short still yields partial text — salvaged by `parseRecommendationsJSON` for recommendations, shown as a partial reply in the assistant; `jsonGenerationMaxTokens: 3000` (vs the 8000 default) keeps generations short; and `thinking: {type:'disabled'}` is requested for both JSON generation and assistant chat, with `_openaiCompatible.chat()` retrying once without the field on an HTTP 400 (some GLM models refuse to have reasoning disabled). `formatHttpError()` recognizes the Lambda `errorType`/`errorMessage` shape and reports a timeout rather than a bogus provider error. If 60s still proves too tight, the next step is porting the proxy to a Supabase Edge Function (150s free / 400s paid). See `Archive_doc_update/zai-cloud-502-known-issue.md`.

# Backend Modules

- `server.js` — entry; loads `.env`, mounts `/api` routes, binds `0.0.0.0`.
- `database.js` — SQLite conn, schema init, auto-migration.
- `routes/index.js` — single ~960-line router: all CRUD + `/ollama/*`, `/recommendations`, `/assistant`, `/analytics`, import endpoints. `/api/movies` takes a `type` query param and serves all four content types; `/api/tv` is a TV-only legacy alias. There is deliberately **no** `/api/podcasts` or `/api/books` — both use `/api/movies?type=…`.
- `ollama-recommender.js` — recommendations + 24h cache.
- `assistant.js` — chat assistant over Ollama (filters to `status='watched'`).
- `taste-analyzer.js` — builds the persisted taste profile.
- All three AI modules handle all four content types (movies, TV, podcasts, books).
- `db-importer.js` / `letterboxd-importer.js` — CSV/SQLite/Letterboxd import via `multer` uploads to `backend/uploads/`.

Frontend state: `MovieContext.jsx`, `TVSeriesContext.jsx`, `PodcastContext.jsx`, `BookContext.jsx`, `FriendsContext.jsx` (React Context, consumed via hooks).

**Podcast lookup**: `frontend/src/api/podcastLookup.js` hits the iTunes Search API directly from the browser (CORS confirmed, `access-control-allow-origin: *`) for artwork + autofill; degrades to manual entry on failure. `release_year` is deliberately **not** autofilled — the iTunes `releaseDate` is the latest-episode date, not the show's debut.

**Book metadata**: `frontend/src/api/bookLookup.js` queries Open Library (`https://openlibrary.org/search.json`) **directly from the browser**. It needs no key, is CORS-open, and needs no proxy. Covers come from `covers.openlibrary.org/b/id/{cover_i}-{S|L}.jpg`; always look covers up by cover ID, because ISBN/OLID cover lookups are rate-limited per IP. `first_publish_year` is the real debut, so unlike podcasts `release_year` **is** autofilled. Open Library `subject` lists are mapped onto `BOOK_GENRE_LIST` by ordered rules (`mapSubjectsToGenre`), and anything unmapped leaves the user's genre alone. Credited in the Credits block of `settings/DataSection.jsx`, which now always renders (the TMDB line inside it stays conditional).

**Movie/TV lookup**: `frontend/src/api/tmdbLookup.js` queries TMDB directly from the browser (CORS-friendly; TMDB permits client-side keys) using `VITE_TMDB_TOKEN` (the v4 API Read Access Token). When the token is unset, `TMDB_ENABLED` is false and the Find box is not rendered. Picking a result fetches details (movies: director, genre, poster; TV: seasons, episodes, genre, poster) via `getMovieDetails` / `getTVDetails`, which never throw and fall back to title + year. TMDB genres are mapped onto MILO's fixed movie/TV genre list, and anything unmappable leaves the user's choice alone. Posters are saved to `artwork_url`. The UI for all four lookups is `components/shared/TitleSearch.jsx`, wrapped by `PodcastSearch`, `books/BookSearch`, `movies/MovieSearch`, and `tv/TVSeriesSearch`. TMDB's terms require attribution (the Credits block in `settings/DataSection.jsx`) and cover non-commercial use only; MILO is free, so this is fine.

**Genres**: `frontend/src/utils/genreColors.js` splits `SCREEN_GENRE_COLORS` (film/TV) from `PODCAST_GENRE_COLORS` (iTunes `primaryGenreName` strings); `GenreFilter` takes a `genres` prop so each section filters its own list, and unknown genres fall back gracefully. Users can override colors per genre through `utils/userPrefs.js` — persisted at `milo.userPrefs.v1` in `localStorage`, with `subscribeUserPrefs()` notifying listeners and `getEffectiveGenreColors()` merging defaults with overrides.

# Cloud Mode Build

Required build-time env (see `frontend/.env.example`):
- `VITE_MILO_MODE=cloud`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional: `VITE_ZAI_PROXY_URL` (overrides the z.ai proxy endpoint for both web and native builds).

Optional: `VITE_TMDB_TOKEN` (enables the movie/TV Find lookup; works in local mode too — the lookup is hidden when unset).

# Marketing Site

`MILO_Landing/milo-landing/` is a **separate, standalone static site** — a single `index.html` with CDN Tailwind, three screenshots, and its own `netlify.toml` (no build command; `publish = "."`; CSP / `X-Frame-Options` headers; SPA fallback). It shares no code with `frontend/` and is deployed as its own Netlify site. Do not confuse it with the in-app `/landing` route, which is the React-rendered `pages/LandingPage.jsx`.

# Import / Migration

- Letterboxd import: parsed client-side in `frontend/src/api/letterboxdClient.js` (local → backend API; cloud → direct Supabase inserts).
- Goodreads import: `components/books/GoodreadsImportModal.jsx` (Settings → Data, and the empty Books library) + `frontend/src/api/goodreadsClient.js`, parsed client-side in both modes. Shelves map read → `watched`, to-read / currently-reading → `to_watch`; stars ×2; custom exclusive shelves and read-but-unrated rows are skipped and counted (MILO requires a rating on `watched`). Covers are resolved at import time in two batched Open Library passes — `lookupByIsbns` (40 ISBNs per `isbn:(… OR …)` query), then `lookupByTitles` for rows with no ISBN (Kindle editions) — never one request per book. Written via `bookApi.importBooks`: chunked bulk insert in cloud, sequential POSTs in local (no bulk backend route).
- Migrate local SQLite → Supabase: `node scripts/migrate-sqlite-to-supabase.js --user-id <auth-uid>` (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env).
- In-app local→cloud migration parses the uploaded `movies.db` **client-side**: `frontend/src/api/dbClient.js` bundles sql.js as WASM (`sql.js/dist/sql-wasm.wasm?url`) so `cloud.js` can read the SQLite file in the browser — no backend involved.

# No Verification Commands

No tests, linting, type-checking, or CI are configured. `backend` `npm test` just errors. **Do not run `npm test`, `npm run lint`, or `tsc`** — they will fail or no-op. The closest available check is `cd frontend && npm run build`, which surfaces import and syntax errors.
