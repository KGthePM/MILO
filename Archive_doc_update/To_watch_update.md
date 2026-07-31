# To Watch Tab Implementation Plan (v2)

## Overview
Add a "To Watch" tab to both the Movies and TV pages so users can track titles they want to see. Introduce a `status` column on the `movies` table that distinguishes watched entries from queued ones, and make sure unwatched entries don't pollute analytics, recommendations, or the AI assistant.

## Scope
- **Movies + TV**: both `MoviesPage` and `TVSeriesPage` get a "To Watch" tab. All schema, route, context, modal, and card changes apply symmetrically.
- **Both modes**: local (SQLite via Express) and cloud (Supabase).

## Key Decisions
- **Column**: `status TEXT DEFAULT 'watched'` (string, not boolean — leaves room for `'watching'` / `'dropped'` later, useful for TV).
- **Status values (v1)**: `'watched'` | `'to_watch'`.
- **Defaults**: existing rows → `'watched'`. New inserts from Movies/TV tabs → `'watched'`. New inserts from To Watch tab → `'to_watch'`.
- **Wishlist rows are excluded** from: analytics, AI assistant context, AI recommendations, and home-page stats. They are only visible in the To Watch tab and the global search.

---

## 1. Database Schema Changes

### 1a. SQLite — `backend/database.js`
Two changes needed in `migrateDatabase()`:

1. **Add `status` column** with default `'watched'` (existing rows auto-migrate).
2. **Drop `NOT NULL` on `rating`** — wishlist rows have no rating yet. Supabase's schema already allows NULL (`supabase/migrations/0001_init.sql:9`), so this aligns the two modes.

Since SQLite can't `ALTER COLUMN`, use the existing rebuild-via-rename pattern already in `migrateDatabase()`:
- Detect missing `status` column via `PRAGMA table_info(movies)`.
- Create new table with `rating REAL` (nullable) and `status TEXT DEFAULT 'watched' NOT NULL`.
- Copy data over (defaulting `status` to `'watched'`).

### 1b. Supabase — `supabase/migrations/0005_add_status.sql`
(Next number after the existing `0004_fix_handle_new_user.sql`.)

```sql
ALTER TABLE movies ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'watched';
CREATE INDEX IF NOT EXISTS movies_user_status_idx ON movies (user_id, status);
```

No RLS changes needed — existing user-scoped policies already cover the new column.

---

## 2. Backend API Changes — `backend/routes/index.js`

### 2a. Add `status` to explicit destructures (NOT dynamic mapping)
PUT and POST handlers in this file use **explicit destructures**, not `Object.keys(req.body)`. You must add `status` to each:

- `POST /api/movies` (~line 136): add `status = 'watched'` to the destructure and INSERT column list.
- `PUT /api/movies/:id` (~line 163): add `status` to the destructure and to the SET clause.
- `POST /api/tv` (~line 299): same as movies POST.
- `PUT /api/tv/:id` (~line 326): same as movies PUT.

### 2b. Add `status` query filter on GET
`GET /api/movies` and `GET /api/tv`:
```js
if (req.query.status) {
  whereConditions.push(`status = ?`);
  params.push(req.query.status);
}
```

### 2c. Exclude wishlist from recommendations & analytics
This is the highest-risk gap in v1. Wishlist items must not flow into AI context or stats.

- **Recommendations route** (~line 384, `SELECT * FROM movies WHERE type IN (...)`): add `AND status = 'watched'` so the recommender only sees viewing history.
- **Analytics route** (~line 480+): exclude `status = 'to_watch'` from all aggregations (genre breakdown, ratings distribution, totals, etc.).
- **Assistant context** (`backend/assistant.js`, `buildContext()` at line 6): filter `movies.filter(m => m.status === 'watched')` at the top of the function before computing top-rated / favorite genres / favorite directors.
- **Caller of assistant** (assistant route ~line 466 in routes): no change needed if `buildContext` filters internally.

### 2d. De-duplication check on POST
When inserting, if a row with the same `title` + `type` for this user already exists in the opposite status, return a 409 with the existing id so the frontend can offer to "move" instead of duplicate.

---

## 3. Frontend State — `frontend/src/utils/MovieContext.jsx` (and TV parallel)

### `addMovie` accepts optional status
```js
const addMovie = async (movie, defaultStatus = 'watched') => {
  await movieApi.addMovie({ ...movie, status: movie.status || defaultStatus });
  await fetchMovies();
};
```

### `updateMovieStatus` convenience helper
```js
const updateMovieStatus = async (id, status) => {
  await updateMovie(id, { status });
  await fetchMovies();
};
```

Mirror both in `TVSeriesContext`.

---

## 4. Movies & TV Pages — tab + content

**Files**: `frontend/src/pages/MoviesPage.jsx`, `frontend/src/pages/TVSeriesPage.jsx`.

### Add tab button
```jsx
<button
  onClick={() => setActiveTab('to_watch')}
  className={activeTab === 'to_watch'
    ? 'bg-amber-500/20 text-amber-300 neon-border-amber'
    : 'text-white/70 hover:text-white hover:bg-white/5'}
>
  To Watch
</button>
```
(Use amber to distinguish from the cyan "watched" tab; verify it reads against the neon theme.)

### Add case in `renderContent()`
```jsx
case 'to_watch':
  return (
    <MovieGrid
      movies={movies
        .filter(m => m.status === 'to_watch')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))}
      showDateWatched={false}
      showRating={false}
      onMarkWatched={handleMarkWatched}
      onRemove={handleRemove}
    />
  );
```

### Exclude wishlist from the "Movies" / "Series" tab counts
The default tab should only show `status === 'watched'`. The header count in each tab should be scoped to that tab's filter, not `movies.length`.

### "Mark as watched" handler — open the edit modal
Don't silent-toggle. When a wishlist item is marked watched, the user almost always wants to enter a rating and date right then:
```js
const handleMarkWatched = (movie) => {
  setEditTarget({ ...movie, status: 'watched' });
  setEditModalOpen(true); // pre-focused on rating + date_watched fields
};
```

### Pass `activeTab` (or `defaultStatus`) into `AddMovieModal`
Currently the modal is rendered as `<AddMovieModal isOpen onClose />` — it has no tab awareness. Add:
```jsx
<AddMovieModal
  isOpen={addOpen}
  onClose={() => setAddOpen(false)}
  defaultStatus={activeTab === 'to_watch' ? 'to_watch' : 'watched'}
/>
```

---

## 5. AddMovieModal — `frontend/src/components/movies/AddMovieModal.jsx` (and TV parallel)

### Accept `defaultStatus` prop and initialize formData
```js
const [formData, setFormData] = useState({ ..., status: defaultStatus });
```

### Conditionally render fields by status
- `status === 'watched'`: show all current fields (rating, date_watched required).
- `status === 'to_watch'`: hide `rating` and `date_watched`; make `director`, `release_year`, `genre` optional (user may not know them yet). Only `title` is required.

### Status selector at the top of the form
```jsx
<select
  value={formData.status}
  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
>
  <option value="watched">Watched</option>
  <option value="to_watch">To Watch</option>
</select>
```
So users can switch intent mid-form.

### Handle the de-duplication 409 from backend
If POST returns 409 with an existing id and status, show an inline prompt: *"'Inception' is already in your Watched list — move it to To Watch instead?"* On confirm, call `updateMovieStatus(existingId, 'to_watch')`.

---

## 6. MovieCard / SeriesCard — status badge + action

**Files**: `frontend/src/components/movies/MovieCard.jsx`, `frontend/src/components/tv/SeriesCard.jsx` (verify exact path).

### Conditional rendering for unwatched items
```jsx
{movie.status === 'to_watch' && (
  <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
    To Watch
  </span>
)}

{movie.status === 'watched' && movie.rating != null && (
  <RatingDisplay rating={movie.rating} />
)}

{movie.status === 'watched' && movie.date_watched && (
  <DateWatched date={movie.date_watched} />
)}
```
Guard against NULL `rating` and NULL `date_watched` — these currently assume non-null.

### "Mark as watched" button (only on to_watch items)
```jsx
{movie.status === 'to_watch' && (
  <button onClick={() => onMarkWatched(movie)} title="Mark as Watched">
    <CheckIcon />
  </button>
)}
```

---

## 7. Cloud-mode pass-through — `frontend/src/api/cloud.js`

The cloud client already spreads `{...movie}` into the Supabase insert/update payload, so `status` flows through automatically. **No change needed**, but verify:
- `movieApi.addMovie` payload includes `status`.
- `movieApi.updateMovie` doesn't strip `status` in its known-fields filter.

### Letterboxd import — `frontend/src/api/letterboxdClient.js`
The default column value (`'watched'`) will cover imported rows in cloud mode, but **explicitly set `status: 'watched'`** on each row in the bulk insert to make intent obvious and avoid surprises if the default ever changes.

(Letterboxd "watchlist" export support → out of scope for v1; note as future work.)

---

## 8. Implementation Order

1. Migrations: SQLite rebuild (status + nullable rating) and Supabase `0005_add_status.sql`.
2. Backend routes: add `status` to all four destructures (movies + TV, POST + PUT), add GET filter, add 409 dedup.
3. Backend AI/analytics filtering: assistant `buildContext`, recommendations SQL, analytics route.
4. Context layer: `addMovie(_, defaultStatus)` + `updateMovieStatus` in both Movie and TV contexts.
5. Pages: add `'to_watch'` tab + handler + correct counts in MoviesPage and TVSeriesPage.
6. AddMovieModal + Add TV modal: `defaultStatus` prop, conditional fields, status selector, 409 handling.
7. MovieCard + SeriesCard: badge, conditional rating/date rendering, "Mark as watched" button.
8. Letterboxd client: explicit `status: 'watched'`.
9. End-to-end verification (see §10).

---

## 9. Files to Modify

**Backend / DB**
- `backend/database.js` — migration: add `status`, drop NOT NULL on `rating`
- `backend/routes/index.js` — destructures (movies + TV, POST + PUT), GET filter, analytics filter, recommendations filter, 409 dedup
- `backend/assistant.js` — `buildContext` filters to `status === 'watched'`
- `supabase/migrations/0005_add_status.sql` — new file

**Frontend — Movies**
- `frontend/src/utils/MovieContext.jsx`
- `frontend/src/pages/MoviesPage.jsx`
- `frontend/src/components/movies/AddMovieModal.jsx`
- `frontend/src/components/movies/MovieCard.jsx`

**Frontend — TV (parity)**
- `frontend/src/utils/TVSeriesContext.jsx` (verify name)
- `frontend/src/pages/TVSeriesPage.jsx`
- `frontend/src/components/tv/AddTVSeriesModal.jsx` (verify name)
- `frontend/src/components/tv/SeriesCard.jsx` (verify name)

**Frontend — shared**
- `frontend/src/api/letterboxdClient.js` — explicit `status: 'watched'` on import rows
- `frontend/src/api/cloud.js` — verify `status` passes through (likely no change)

---

## 10. Testing Checklist

**Migration**
- [ ] Existing SQLite `movies.db` migrates: all old rows get `status='watched'`, rating constraint relaxed to nullable
- [ ] Fresh SQLite DB initializes with new schema
- [ ] Supabase migration `0005_add_status.sql` applies cleanly; existing rows default to `'watched'`; index created

**Backend**
- [ ] POST /api/movies with `status: 'to_watch'` and no rating succeeds (no NOT NULL violation)
- [ ] PUT /api/movies/:id with `{ status: 'watched', rating, date_watched }` updates all three
- [ ] GET /api/movies?status=to_watch returns only wishlist items
- [ ] POST duplicate title returns 409 with existing id
- [ ] Same four behaviors verified for `/api/tv`

**AI / analytics isolation (critical)**
- [ ] Add a wishlist movie → confirm it does NOT appear in `/api/analytics` aggregations
- [ ] Confirm it does NOT appear in AI assistant's "top rated" / favorite genres / directors
- [ ] Confirm recommender does NOT receive it as viewing history and does NOT suggest titles already on the wishlist

**Frontend — Movies & TV**
- [ ] Movies tab shows only `watched`; To Watch tab shows only `to_watch`; counts match
- [ ] Add from Movies tab → defaults to `watched`; add from To Watch tab → defaults to `to_watch`
- [ ] Wishlist card hides rating + date_watched, shows amber "To Watch" badge
- [ ] "Mark as watched" on a wishlist card opens edit modal pre-populated with `status='watched'`, focused on rating/date
- [ ] Saving the edit moves the item from To Watch tab to Movies tab
- [ ] 409 dedup prompt appears when adding a title that already exists in the other status
- [ ] All of the above re-verified on the TV side

**Cloud mode**
- [ ] All movie + TV flows above work against Supabase
- [ ] Letterboxd import rows land with `status='watched'` (visible in Movies tab, not To Watch)

**No regressions**
- [ ] Existing watched movies still render rating + date_watched correctly
- [ ] Home page stats, friend-share counts, and any other movie aggregations exclude wishlist items
