# Books: MILO's fourth content type

> **Status (2026-09-24):** Phases 1–4 implemented in one pass, since the registry
> entry makes Books appear in the nav immediately, so shipping Phase 1 alone would
> have left a dead tab. Build passes; SQLite migration verified on old-schema and
> fresh DBs. **Awaiting device testing.** Before deploying cloud: run
> `supabase/migrations/0011_books.sql`. Remaining: the "Later / optional" items.
>
> Deviations from the plan below:
> - Bottom nav: Refresh moved to `lg:` only (tab padding untouched).
> - Friend-profile tabs and Timeline filters go icon + count / icon-only below `sm`.
> - Genre mapping is a position-weighted vote, not first-match. Open Library
>   subjects include tags from adaptations (Gatsby carries "Comics & Graphic
>   Novels"), so the first match was often wrong.
> - `publisher` is not autofilled or shown for books (Open Library's publisher
>   list is every edition's publisher; too noisy to be useful).

## Context
MILO is moving from "movies/TV/podcasts" toward media in general. Books add depth to a user's persona and to what friends can connect over. Podcasts (commit `0b775d4`) already went through adding a type to the shared `movies` table, and the `contentTypes.js` registry exists so the next type is mostly "add a registry entry, then fix each consumer." Books follow that same path.

**Decisions made:** new `neon-orange` accent · Read / To Read only (reuse `status='watched'|'to_watch'`, no new status) · no format field · **Open Library** as the lookup API.

**Why Open Library:** it's free with no key and no signup. `openlibrary.org/search.json` sends `Access-Control-Allow-Origin: *`, so we can call it straight from the browser like iTunes, with no proxy and no env var. Covers come from `covers.openlibrary.org/b/id/{cover_i}-L.jpg`, and lookup by cover ID isn't rate-limited. `first_publish_year` is the book's actual debut, so unlike iTunes we can autofill `release_year`. Non-commercial use is fine, and we credit it in Settings the same way we credit TMDB. Google Books is the fallback option if the metadata turns out thin, but it isn't in scope.

**Deliverable for the "in parts" ask:** step 1 of Phase 1 copies this plan into `Archive_doc_update/books-plan.md` (next to the other plan docs), and each phase gets checked off there.

---

## Phase 1: Data layer + registry (nothing user-visible yet)
- Copy this plan to `Archive_doc_update/books-plan.md`.
- **Tokens:** `neon-orange` (~`#ff7a18`) in `frontend/tailwind.config.js` (color + boxShadow), plus `.neon-text-orange` / `.neon-border-orange` in `frontend/src/index.css`, mirroring the purple ones.
- **Registry** `frontend/src/utils/contentTypes.js`: `book` entry (`accent:'orange'`, nav `Books`, plural `books`, path `/books`, verb `Read`, verbTo `To Read`, promptLabel `books`); `TYPE_ICONS.book = BookOpen`; a full literal `ACCENT.orange` block with every key the other three have.
- **DESIGN.md:** add Orange → Books to the accent table. Update CLAUDE.md + AGENTS.md together.
- **Schema.** New nullable columns: `author text`, `page_count integer`, `pages_read integer`. Reuse the existing `publisher`, `artwork_url`, `release_year`, `genre`, and `notes`.
  - `supabase/migrations/0011_books.sql`: same shape and comments as `0009_podcasts.sql`. No RLS or index change needed.
  - `backend/database.js`: a `BOOK_COLUMNS` guarded additive `ALTER TABLE` (same path as `PODCAST_COLUMNS`). Also extend the `recoverTvTypes()` guard so a book row with `page_count` can't be turned into TV.
- **API switchers:** `frontend/src/api/bookApi.js` + `bookApi.local.js` (copy `podcastApi*.js`); `bookApi` in `cloud.js` (copy the `podcastApi` block at `cloud.js:407`). Local mode reuses `/api/movies?type=book` with no new route, like podcasts. Check `backend/routes/index.js` for `normalizeType` / type allow-lists and add `book`.
- `frontend/src/api/dbClient.js`: make sure the new columns are passed through on insert/update.
- Check: `cd frontend && npm run build`.

## Phase 2: Books page + Add/Edit + Open Library lookup
- `frontend/src/api/bookLookup.js`: `searchBooks(q, {limit})` → `search.json?q=…&fields=key,title,author_name,first_publish_year,number_of_pages_median,cover_i,subject,publisher&limit=…`. Returns `{title, author, year, pages, artworkUrl, genre}`. Never throws; any failure falls back to manual entry (same contract as `podcastLookup.js`). Map `subject[]` keywords onto a fixed book genre list. If nothing maps, leave the user's choice alone (same rule as TMDB).
- `utils/genreColors.js`: `BOOK_GENRE_COLORS` (Fiction, Literary Fiction, Fantasy, Sci-Fi, Mystery, Thriller, Romance, Horror, Historical Fiction, Young Adult, Graphic Novel, Poetry, Nonfiction, Biography & Memoir, History, Science, Philosophy, Self-Help, Business, Essays).
- `components/books/`: `BookSearch.jsx` (wraps `shared/TitleSearch.jsx`), `AddBookModal.jsx`, `EditBookModal.jsx` (portal to body, per `776905b`), `BookCard.jsx` (poster 2:3 via `shared/CoverArt.jsx`, author line, pages-read / page-count progress), `BookRecommendations.jsx`, `BookTimeline.jsx`. Copy the podcast versions and swap fields.
- `utils/BookContext.jsx` (copy `PodcastContext.jsx`); `pages/BooksPage.jsx` (copy `PodcastsPage.jsx`); route + provider in `App.jsx`.
- `api/artworkLookup.js`: add a `lookupBook` branch so cover backfill works for books.
- Add the Open Library credit to the Credits block in `settings/DataSection.jsx`.

## Phase 3: Shared surfaces (the "binary choke points")
Grep for `podcast`, `NAV_ICONS`, `TAB_ICONS`, and three-way ternaries, and fix each one to be registry-driven where it isn't already:
- **Bottom nav** `shared/FloatingCommandBar.jsx`: add to `NAV_ICONS` + `ICON_BTN_ACCENT`. **Width risk:** the mobile bar is already ~354px of `shrink-0` content inside ~377px on a 393px iPhone, and a 5th tab (~40px) will overflow. Fix: show Refresh only at `lg:` and above (the contexts already reload on mount/navigation). If that's still too tight, trim the tab `px-2.5` to `px-2`. Explain why in a comment next to the existing width comment.
- `pages/FriendProfilePage.jsx`: `TAB_ICONS` + the tab strip. The comment at ~line 130 says a third tab already ran off the edge, so make the strip horizontally scrollable, or icon + count only on mobile. Show author for book items the way host is shown for podcasts (~line 36).
- `timeline/CombinedTimeline.jsx`, `pages/TimelinePage.jsx`: filter chip + book rows.
- `shared/Stats.jsx`, `StatsSkeleton.jsx`, `EmptyState.jsx`, `SkeletonGrid.jsx`, `GenreFilter.jsx`, `CoverArt.jsx`, `AssistantModal.jsx`: add book copy/labels ("Pages read" stat instead of episodes).
- `settings/DataSection.jsx`: Books CSV export (same as the podcast export in `2608005`).

## Phase 4: AI layer (local + cloud mirrors)
- Cloud: `frontend/src/ai/prompt.js`, `ai/index.js`, and the `cloud.js` taste-profile functions (`profileSignature`, `shouldAutoRefreshProfile`, `generateAndSaveProfile`, assistant `chatWithAssistant`). Add a `books` list next to `podcasts` everywhere (search `podcasts` in `cloud.js`).
- Local: `backend/assistant.js`, `taste-analyzer.js`, `ollama-recommender.js`, and the `['movie','tv','podcast']` lists in `routes/index.js` (~464, 533, 591, 607, 682). `api/assistantApi.local.js`.
- `recommendations/presets.js`: book Quick Hitters presets. `EnhancedRecommendations.jsx`: book tab, with rec-card covers via `bookLookup`.
- Prompt wording: books are "read", with an author. Cross-media recs ("you loved *Dune* the film → try the novel") are the big win here.

## Later / optional
- ~~**Goodreads CSV import**~~: **done 2026-09-24**. See `GoodreadsImportModal.jsx` / `goodreadsClient.js`.
- A "Reading" status for books/TV/podcasts together (turned down for v1).

## Critical files
`utils/contentTypes.js`, `tailwind.config.js`, `index.css`, `DESIGN.md`, `backend/database.js`, `supabase/migrations/0011_books.sql`, `api/cloud.js`, `api/bookLookup.js` (new), `components/books/*` (new), `pages/BooksPage.jsx` (new), `shared/FloatingCommandBar.jsx`, `pages/FriendProfilePage.jsx`, `ai/prompt.js`, `backend/routes/index.js`.

## Verification
- After each phase: `cd frontend && npm run build`. No other checks exist. Kyle does the hands-on testing, so each phase ends with a short test list for him:
  - P1: apply `0011` in Supabase and start the backend locally. Existing movies/TV/podcasts are unchanged, and the new columns exist in both DBs.
  - P2: search "Project Hail Mary", pick it, and confirm the cover, author, year, pages and genre autofill. Add it as Read and as To Read. Edit it. Turn off network: the lookup degrades to manual entry.
  - P3: on iPhone portrait, the bottom nav fits with no clipping. A friend's profile shows a Books tab. The timeline filter works. The orange glow shows in the prod build (catches purged classes).
  - P4: the assistant mentions books. The taste profile refreshes after you add books. The Books recs tab returns books with covers.
- Web testing means pushing `main` (Netlify only deploys main). iOS: `npm run build && npx cap sync ios`.
