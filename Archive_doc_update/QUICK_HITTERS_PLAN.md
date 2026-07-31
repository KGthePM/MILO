# Quick Hitters — Implementation Plan

Status: **Planning** (not started)

> Quick Hitters are one-click preset recommendation scenarios added to Smart Recs
> (e.g. "Rainy Day Comfort", "Feel-Good Fix"). Each preset injects a curated
> directive into the AI prompt on top of the existing taste signals, so recs stay
> personalized but gain a mood/context flavor.

---

## Behavior Model

- **Chip row** lives in `EnhancedRecommendations.jsx` setup area, **above** the
  existing Similar / Hidden Gems dropdown.
- **Replace when active**: clicking a chip makes it the active mode; the
  Similar/Hidden Gems dropdown is visually disabled and ignored while a preset
  is active.
- **Select then Generate**: clicking a chip only selects it (highlights it). The
  user still hits **Generate**. No auto-fire.
- **Deselect**: clicking the active chip again, or choosing a filter from the
  dropdown, clears the preset and returns to type-based mode.
- **Refresh** (`handleRefresh`) re-uses the currently active preset.
- **Content agnostic**: presets work on whichever tab is open (Movies or TV);
  the prompt adapts via the existing `contentType` label. No TV-only / movie-only gating.

---

## The 8 Presets

| # | Preset | Directive (prompt flavor) |
|---|--------|---------------------------|
| 1 | Rainy Day Comfort | Cozy, immersive, bad-weather escapism |
| 2 | Feel-Good Fix | Uplifting, warm, satisfying endings |
| 3 | Dark & Heavy | Intense, psychological, lingers after watching |
| 4 | Mind Melts | Twisty, puzzle-box, thought-provoking |
| 5 | Date Night | Broad appeal, conversation-worthy, well-paced |
| 6 | Group Watch | Crowd-pleasing, low-friction, broadly accessible |
| 7 | Short & Sweet | ≤100 min runtime, low commitment, punchy |
| 8 | Cult & Polarizing | Divisive, love-it-or-hate-it, cult appeal |

Each directive is appended to the user prompt **in addition to** the taste
signals (taste profile or library digest) and the title exclusions.

---

## Code Changes

### 1. UI — `frontend/src/components/recommendations/EnhancedRecommendations.jsx`
- [ ] New state: `activePreset` (`null | presetId`).
- [ ] `PRESETS` constant imported from the shared presets module (see #6).
- [ ] Chip row rendered above the type dropdown (lines ~321-361 setup row).
- [ ] Click handler: toggle `activePreset`; when set, disable the type dropdown.
- [ ] Clicking the type dropdown while a preset is active clears `activePreset`.
- [ ] `fetchRecommendations` (~`:103-128`): when `activePreset` is set, send
      `params.preset = activePreset` (and omit/ignore `type`).
- [ ] `handleGenerate` (~`:249-252`) and `handleRefresh` pass `activePreset`
      through so Refresh re-uses it.

### 2. API clients — pass `preset` query param through
- [ ] `frontend/src/api/movieApi.local.js:50` (`getRecommendations`)
- [ ] `frontend/src/api/tvApi.local.js:52` (`getRecommendations`)
- [ ] `frontend/src/api/cloud.js` (`getRecommendations`, ~`:219`) — forward
      `preset` into the `aiGenerate` call

### 3. Backend route — `backend/routes/index.js:459`
- [ ] Read `req.query.preset`.
- [ ] Thread it into `ollamaRecommender.generateRecommendations(...)` calls
      (~`:499-522`).

### 4. Prompt builder (MIRRORED — must stay byte-identical)
Both files implement `buildRecommendationPrompt`:
- `backend/ollama-recommender.js:330`
- `frontend/src/ai/prompt.js:141`

Changes (apply to BOTH):
- [ ] Accept a `preset` argument.
- [ ] When `preset` is present:
  - Append the preset's directive text to the user prompt.
  - **Skip** the `similar` / `hidden_gems` instruction block
    (`ollama-recommender.js:407-426`, `prompt.js:217-235`).
- [ ] Keep the exclusion block (watched + recently shown + feedback) unchanged.

### 5. Cache key (MIRRORED — must stay in sync)
- [ ] `backend/ollama-recommender.js` — append `:${preset}` to the cache
      signature so different presets don't collide.
- [ ] `frontend/src/ai/prompt.js` — mirror the same signature change.

### 6. Shared presets module (single source of truth for directives)
- [ ] Create `frontend/src/recommendations/presets.js` exporting `PRESETS`
      (`[{ id, label, directive, emoji? }]`).
- [ ] UI imports labels/emojis from it.
- [ ] Prompt builders import directives from it (or a mirrored copy for the
      backend) so directive text lives in exactly one place.

---

## Verification (manual — no automated tests in this repo)

- [ ] **Local mode**: pick a preset → Generate → confirm the prompt sent to
      Ollama contains the preset directive.
- [ ] **Cache isolation**: generate with preset A, then preset B → confirm B is
      not a cache hit for A (different cache key).
- [ ] **Deselect**: clicking the active chip clears it; Generate then behaves as
      the old Similar/Hidden-Gems flow (regression check).
- [ ] **Filter re-engagement**: choosing Similar/Hidden Gems while a preset is
      active clears the preset.
- [ ] **Refresh**: Refresh re-uses the active preset.
- [ ] **Cloud mode**: same preset path works via `cloud.js` / browser BYOK.
- [ ] **Both tabs**: presets work on Movies and TV tabs.

---

## Notes

- Per `AGENTS.md`: no tests, linting, type checking, or CI is configured. Do not
  run verification commands.
- Prompt functions are intentionally duplicated between
  `backend/ollama-recommender.js` and `frontend/src/ai/prompt.js` (local vs
  cloud mode). Any prompt/cache change must be applied to **both**.
