# Taste Analysis — Update Plan

> **Status:** **Phase A shipped (2026-07-30).** The richer library digest, anti-repetition,
> and cleanup landed as a leaner first pass that fixes "impersonal + repetitive" without any
> new infrastructure. The full persisted **Taste Profile** described below is now **Phase B
> (not started)** — revisit once Phase A proves the richer signal helps.
>
> Phase B was subsequently built (persisted profile + UI + assistant unification). See the
> **Post-Ship Fix Log** immediately below for a live issue found while testing it.

---

## ✅ Phase C — Recommendation Feedback Loop (shipped 2026-07-30, cloud-first)

MILO now learns whether its recs actually land. Each AI rec card gets three reactions:
**Interested** (records feedback + adds the title to the watchlist as `status='to_watch'`),
**Not for me** (durable exclusion + "learn from these" signal), **Seen it** (durable
exclusion for titles watched but never logged — covers the gap left by the 300-title cap).

- **Persistence:** new `rec_feedback` table — `supabase/migrations/0007_rec_feedback.sql`
  (**applied to live project 2026-07-30** via MCP `apply_migration`; RLS + owner policies
  verified) and a mirrored SQLite `ensureRecFeedbackTable()` in `backend/database.js`.
  Unique per `(user_id,) normalized_title, content_type`; re-reacting upserts.
- **Prompts:** `formatRecFeedbackForPrompt` added to the hand-mirrored pair
  (`frontend/src/ai/prompt.js` + `backend/ollama-recommender.js`), appended after the
  exclusion block. Feedback titles dedupe against the watched list; feedback wording wins
  over the recently-shown list. Parsed model output is also hard-filtered against feedback
  titles. Watchlisted/rejected recs also feed the taste-analysis digest (≤15 each).
- **Cloud wiring:** `feedbackApi` (list/record/remove) in `frontend/src/api/cloud.js`,
  feedback loaded + grouped (caps: 40 not_for_me / 25 interested / 40 seen_it) in
  `getRecommendations` and `tasteApi.generateProfile`; switcher pair
  `frontend/src/api/feedbackApi.js` / `.local.js`.
- **UI:** three ghost buttons per rec card in `EnhancedRecommendations.jsx` (cloud mode,
  AI recs only). Toggle to undo; undoing "Interested" removes only a watchlist row created
  in the same session. Cards stay on screen after feedback — the signal applies on the
  next Generate/Refresh.
- **Mechanical fixes bundled:** staleness signatures (`profileSignature` ×2,
  `librarySignature`) now hash `id|rating|status` (shared `hashLibrary`, mirrored
  byte-identical), so rating/status edits mark the profile stale and bust the local rec
  cache. One-time side effect: existing saved profiles flag stale once. Digest "Disliked"
  block now only includes titles rated ≤ 6.

**Local mode: deferred (user decision).** The prompt layer, signature fix, SQLite table,
and `generateRecommendations({ feedback, feedbackSignature })` plumbing are already in the
backend; still to do: `GET/POST/DELETE /api/rec-feedback` routes in
`backend/routes/index.js`, feeding feedback into `GET /recommendations` +
`POST /taste-profile`, the digest append in `backend/taste-analyzer.js`, and replacing the
`feedbackApi.local.js` stub. The UI hides feedback buttons in local mode until then.

---

## 🐛 Post-Ship Fix Log

### 2026-07-30 — "Could not find the table 'public.taste_profiles' in the schema cache"

**Symptom:** Clicking **Analyze my taste** in cloud mode errors with
`Could not find the table 'public.taste_profiles' in the schema cache`.

**Investigation (done):** This is **not a code bug**. The code and schema are consistent:
- `frontend/src/api/cloud.js` (`tasteApi`, `loadSavedTasteProfile`) reads/writes a
  `taste_profiles` table with columns `user_id, scope, profile_json, library_signature,
  model, generated_at, updated_at` and upserts on `onConflict: 'user_id,scope'`.
- `supabase/migrations/0006_taste_profiles.sql` defines exactly that table + indexes + the
  four owner RLS policies. Column names and the `unique (user_id, scope)` constraint match.

**Root cause:** Migration `0006_taste_profiles.sql` was **never applied to the live Supabase
project**. Migrations 0001–0005 were applied when cloud mode was set up, but 0006 (added for
this taste feature) still only exists in the repo. Supabase has no `taste_profiles` table, so
PostgREST returns the schema-cache error. Unlike the local SQLite path
(`backend/database.js` auto-migrates on startup), Supabase migrations are **not**
auto-applied.

**Fix (✅ APPLIED 2026-07-30 — method: Supabase MCP `apply_migration`):**
1. Authenticated the Supabase MCP server; confirmed the live project is `MILO-movies`
   (`gewqxrzfpxjijqnlfilp`), matching `VITE_SUPABASE_URL`.
2. Applied `supabase/migrations/0006_taste_profiles.sql` verbatim via `apply_migration`
   (records it in the migration history — the history table was previously empty because
   0001–0005 were created ad-hoc via the SQL Editor). The SQL is idempotent, so re-running
   is safe.
3. PostgREST reloaded its schema cache automatically after the DDL.

**Verification (✅ done, all passed):**
- `select count(*) from taste_profiles;` → `0`, no error.
- `list_tables` shows `public.taste_profiles` with `rls_enabled: true`; existing tables
  (`movies` 170 rows, `profiles`, `friend_requests`) untouched.
- Four owner policies present: `owner read:SELECT, owner insert:INSERT,
  owner update:UPDATE, owner delete:DELETE`.
- **Remaining (user to confirm in-app):** sign in, have ≥1 watched title, click
  **Analyze my taste** → profile generates and persists with no schema-cache error;
  reload → saved profile loads back (`tasteApi.getProfile`).

**Follow-up / process note:** New `supabase/migrations/*.sql` files must be applied to the
live project going forward (via MCP, SQL Editor, or `supabase db push`) — they are not
auto-applied like the local SQLite migrations.

---

## ✅ Phase A — Shipped (2026-07-30)

Delivered ~80% of the personalization win plus the repetition fix by feeding a richer digest
into the *existing* recommendation prompt. **No new tables, endpoints, or extra inference
calls.** Prompt text is mirrored across local and cloud (kept in sync by hand).

**Richer library digest** (`buildLibraryDigest`, mirrored in
`backend/ollama-recommender.js` + `frontend/src/ai/prompt.js`) replaces the bare top-5 with:
- **Loved** (top-rated) and **Disliked** (lowest-rated) as *non-overlapping* partitions —
  title, rating, genre, director, **release_year**, and truncated **notes** (both sent for
  the first time).
- **Genre distribution** with count + **average rating** (surfaces loved vs. merely-watched
  genres — now actually consumes the previously-dead `genres`/`directors` sets).
- Frequency-ranked **directors** and **release-decade eras**.
- Length-capped to bound tokens.

**Anti-repetition:**
- Local (`ollama-recommender.js`): bounded per-`contentType:type:model` set of
  recently-shown titles appended as extra exclusions on refresh, plus a random Ollama
  `seed` and raised temperature (0.9) so an unchanged library still diversifies. `refresh`
  threaded from `backend/routes/index.js`.
- Cloud (`frontend/src/api/cloud.js` + `frontend/src/ai/index.js`): module-level
  recently-shown set fed via a new `extraExclusions` param on `buildRecommendationPrompt`.

**Cleanup:**
- Removed dead `genres`/`directors` code; started sending `release_year` (schema already
  had it — `backend/database.js:25`).
- Confirmed both local (`routes/index.js:467`) and cloud (`cloud.js:161`) already pass
  `status='watched'` only, so the watchlist informs exclusions but not the taste signal.

**Not done in Phase A:** no live end-to-end run against Ollama/Supabase (no test harness in
the project). Syntax-checked, bundled, and smoke-tested the prompt output in isolation.

---

## Phase B — Persisted Taste Profile (not started)

> The original design below. Everything under "Concept" through "Implementation Plan"
> remains the plan of record for Phase B, **except** the digest work in step 1 and the
> cleanup in step 8, which shipped in Phase A above. Phase B adds the *persisted, structured*
> profile: a separate inference step, saved artifact, dedicated UI, and assistant
> unification.

> **Original status note:** Planned (not started). This document captures the agreed design
> for a future enhancement to MILO's AI features. It is a reference for when work begins.

## Motivation

The current Smart Recommendations feel impersonal and generic. Investigation of the
code confirms why:

- Both recommendation prompts — local (`backend/ollama-recommender.js:73`) and cloud
  (`frontend/src/ai/prompt.js:11`) — send only the **top 5 highest-rated titles** as the
  entire taste signal, then force the model to do two jobs in one JSON-constrained call:
  (1) understand the user, (2) emit 5 picks. The strict-JSON output makes the model
  "rush" the analysis.
- No persistent taste profile exists — taste is re-derived from 5 titles on every
  request, from scratch.

### Wasted / missing signals (concrete)
- `genres` + `directors` Sets are computed but **never put in the prompt** — dead code
  (`backend/ollama-recommender.js:108-109`).
- `notes` (free-text thoughts) — never sent.
- **Dislikes / low-rated titles** — never sent. The single richest taste signal.
- `release_year` — never sent, even though the prompt says "consider similar
  production era."
- `total_episodes`, `date_watched` patterns — unused.

## Concept

A **Taste Analysis** step: a persistent, user-initiated deep-dive over the full library
that produces a structured, human-readable **Taste Profile**. That profile then
**enhances Smart Recommendations** and **personalizes the MILO Assistant** so both rest
on a real understanding of the user rather than 5 raw titles.

---

## Design Decisions (locked in)

| Decision | Choice |
| --- | --- |
| Mode coverage | **Both local (Ollama) and cloud (BYOK) in parallel** |
| Scope | **Both movies and TV** (unified profile with breakdowns) |
| UI placement | **Inside Smart Recommendations** as an enhancing tool (not a separate tab) |
| Persistence | **Saved profile**, **user-initiated regeneration** ("re-analyze as often as they like to sharpen recs"); no aggressive auto-refresh |
| Assistant | **Unified** — one profile feeds both recs and chat |
| Data signals | **Loved + disliked + notes** (both allowed) |

---

## Implementation Plan

### 1. A richer "library digest" (the real fix) — ✅ SHIPPED IN PHASE A
Build a digest from *all* watched items instead of just top-5. Contains:
- **Loved** (top ~15–20 rated): title, rating, genre, director, **release_year**, **notes** (truncated)
- **Disliked** (bottom ~15 rated) — the biggest new signal, same fields
- Genre distribution (count + avg rating → flags loved vs avoided genres)
- Director frequency, **decade/era distribution**
- Aggregated notes (length-capped to bound token cost)
- Movie vs TV breakdown

Implemented twice (matches existing pattern): server-side for local, browser-side for cloud.
- Local: new `backend/taste-analyzer.js` (sister to `backend/ollama-recommender.js`)
- Cloud: extend `frontend/src/ai/prompt.js` + a digest builder in `frontend/src/api/cloud.js`

### 2. New prompt + structured profile output
`buildTasteAnalysisPrompt(digest)` returns JSON:
```json
{
  "persona": "short vivid label + 1-2 sentence description",
  "summary": "2-3 sentence plain-English read of their taste",
  "favoriteGenres": [{ "genre": "...", "note": "why" }],
  "favoriteDirectors": ["..."],
  "favoriteEras": ["1990s neo-noir", "..."],
  "themes": ["moral ambiguity", "slow-burn pacing", "..."],
  "styles": ["practical effects", "long takes", "..."],
  "dislikes": ["generic superhero CGI", "jump-scare horror", "..."],
  "patterns": ["rates auteur dramas higher than box-office", "..."],
  "hiddenGemAffinity": "...",
  "movieVsTV": "..."
}
```
- Local: `backend/taste-analyzer.js`
- Cloud: `frontend/src/ai/prompt.js`
- Mirrored text in both (consistent with how rec/assistant prompts are already mirrored).

### 3. Provider + endpoint plumbing
- **BYOK:** add a `generateTasteProfile` capability. Factory-based providers get it free
  via `frontend/src/ai/providers/_openaiCompatible.js`; the three hand-written ones
  (`openrouter.js`, `anthropic.js`, `ollama.js`) get a small manual impl using the same
  system+user→JSON pattern they already use for recs.
- **Local:** new route `POST /api/taste-profile` in `backend/routes/index.js` (next to
  `GET /api/recommendations` at line 459), calling `backend/taste-analyzer.js`.
- **Cloud:** add `tasteApi.generateProfile` to `frontend/src/api/cloud.js`, wired through
  `frontend/src/ai/index.js`.

### 4. Persistence (saved, user-initiated)
- **Local:** new SQLite table `taste_profiles(scope, model, profile_json, library_signature, generated_at)`,
  auto-migrated via `backend/database.js:migrateDatabase()`.
- **Cloud:** new Supabase table `taste_profiles` with RLS `auth.uid() = user_id`, added
  to `supabase/migrations/`.
- A **"Re-analyze my taste"** button regenerates on demand.
- A subtle **"stale"** hint appears if the library changed since last generation — but it
  never auto-runs (respects the "user initiates" preference).

### 5. Phase 2 — feed profile into recommendations
Update `buildRecommendationPrompt` in both `backend/ollama-recommender.js:73` and
`frontend/src/ai/prompt.js:11` to accept an optional `tasteProfile`. When present, prepend
the persona + themes + dislikes (instead of the bare top-5) and keep the 300-title
exclusion list. When absent, fall back to today's behavior so nothing breaks.

### 6. Unify the Assistant
Inject the profile into the Assistant context so MILO's chat persona rests on the same
understanding as recs:
- `backend/assistant.js:buildContext` (line 6)
- `frontend/src/ai/prompt.js:buildAssistantPrompt` (line 92)

### 7. UI — panel inside Smart Recommendations
Edit `frontend/src/components/recommendations/EnhancedRecommendations.jsx`:
- New **Taste Analysis** card above the recs list (persona, summary, genre/theme/era/dislike chips).
- States: empty / generating / generated / stale.
- Recs show a subtle "Powered by your Taste Profile" note when a profile is in use.
- Reuse the existing model/provider picker.

### 8. Included cleanup (low-hanging fruit) — ✅ SHIPPED IN PHASE A
- Remove the dead `genres`/`directors` code at `backend/ollama-recommender.js:108-109`
  (now actually used by the digest).
- Start sending `release_year` (the prompt already asks for "similar production era").
- In-memory rec cache stays; the taste profile adds the first *persisted* AI artifact.

---

## Suggested Build Order

1. Library digest (1)
2. Prompt + schema (2)
3. Persistence (4)
4. Provider/endpoint plumbing (3)
5. Wire profile into recs (5)
6. UI panel (7)
7. Assistant integration (6)
8. Cleanup (8)

## Tradeoffs / Notes

- **Cost:** Phase 1 is a separate inference call, so each manual "Re-analyze" = 1 extra
  call (user tokens in cloud mode). Persisted + user-initiated keeps this bounded.
  Phase 2 rec cost is unchanged.
- **Mirror drift:** local/cloud prompt text must stay in sync manually — the same
  constraint the codebase already has. Keep the two copies identical.
- **Privacy:** dislikes and notes are sent to the AI. In local mode they stay in Ollama;
  in cloud mode they go to the user's own BYOK provider (their key, their choice).
