# Sign-in backdrop, empty states, and loading guards

Status: **RESOLVED.** Shipped in `c7e4bbc`, `ded1170`, `7b42321`; web deployed via Netlify and iOS builds 6–8 archived to TestFlight. Confirmed on device by the user on 2026-09-18.

Three pieces of work that turned out to be one thread: the app's visual bar was set by the sign-in screen, and everything behind it was either broken on iOS or never designed.

---

## 1. The horizon grid smeared on iOS

### Symptom

The synthwave grid behind the sign-in card rendered correctly on the web. On the iOS app, in landscape, the lines were visible for roughly two seconds and then degraded into a colour blur. Rotating to portrait and back brought them back sharp for another moment before they smeared again.

### Root cause

`.auth-horizon-grid` was a large element painted with 1px `repeating-linear-gradient`s, marked `will-change: transform`, sitting inside `perspective: 150px` + `rotateX(74deg)`.

WebKit promotes a 3D-transformed element to a composited layer and rasterises its **pre-transform** content once into a fixed-size backing store. The perspective then magnifies that bitmap. So the hairlines nearest the viewer were a stretched cache, not lines being drawn — hence the wash. An orientation change invalidates the tiles, which produced the one sharp re-raster before it settled back. Landscape was worst because the near-edge magnification ratio is highest there.

There is no knob to raise the compositor's raster resolution. The technique was the bug.

Note this was the **second** independent iOS failure of the same effect. `8ab161c` had already fixed a different one — `mask` is a grouping property, so putting it on the same element as `perspective` made WebKit flatten the 3D context and drop the grid entirely.

### Fix

Replaced with `frontend/src/utils/neonHorizon.js`: the perspective is projected in JS and real lines are stroked at device pixel ratio every frame. Nothing is rasterised and stretched, and a resize becomes a buffer realloc. Added a starfield and horizon glow at the same time, plus a warp-out on sign-in.

Key implementation constraints, all deliberate:

- **Bloom without `shadowBlur`.** Canvas `shadowBlur` is pathologically slow in WKWebView. Each line is stroked twice under `globalCompositeOperation = 'lighter'` — wide and dim, then thin and bright.
- **DPR capped at 2.** iPhone Pro reports 3; line art gains nothing visible from it and it triples fill cost.
- **30fps native idle, 60fps during the warp.** Motion is `dt`-integrated so it looks identical, but it halves how often the auth card's `backdrop-filter` recomposites.
- **Loop pauses** on `visibilitychange` and Capacitor `appStateChange`.
- **Reduced motion** draws one settled frame and never starts the loop.

### Second finding: grid density was swinging with orientation

Measured while verifying the projection: portrait gave a lane spacing of 251px — **1.6 vertical lines across a 390px phone** — while landscape gave 6.8.

Lane spacing at the bottom edge works out to `laneCell * (h - vpY) / CAM_Y`; the focal length cancels. With a fixed world-space cell and `f` scaling off viewport *height*, portrait magnified the grid into near-emptiness. Solving that expression for a target count pins density to screen width instead, and it now holds at 8 lanes across in both orientations.

---

## 2. Empty states said the wrong thing

### Symptom

Every empty library showed a grey icon at 50% opacity and two lines of text, six times across three pages. Loading was a spinning ring. It was the screen a brand-new user hit immediately after the sign-in screen.

### The design bug underneath

`watchedMovies.length === 0` fires in two completely different situations wearing identical copy:

- the library genuinely has nothing in it, and
- a search or genre filter matched nothing.

They want opposite affordances — an invitation to add versus a way back out of the filter. Telling someone with 300 films and a mistyped search to "Add your first movie to get started!" is simply wrong.

### Fix

`components/shared/EmptyState.jsx` with a `variant` prop (`library` / `watchlist` / `filtered`); pages compute `filtersActive` and pass it, and the filtered variant offers a working **Clear filters** reset. `components/shared/SkeletonGrid.jsx` replaced the spinners with placeholders in the real card's shape.

The empty-state backdrop is deliberately **flat** — a static repeating gradient with a radial mask, no perspective, no 3D transform. It echoes the sign-in horizon without inheriting the problem from section 1.

---

## 3. Lists claimed to be empty while still loading

### Symptom

Reported by the user immediately after testing build 7: *"this is a long watchlist, why would all those things happen?"*

### Root cause

The watchlist, listen-list and all three timeline tabs had **no loading branch at all** — only `length === 0 ? empty : list`. Those arrays are `[]` until the fetch lands, so during that window each one rendered its empty state and asserted there was nothing there. `FriendsPage` rendered its "Loading…" line and its empty state simultaneously.

Seven sites. Only the watched tabs had ever been guarded.

This was **latent well before** the redesign — but the old empty state was a muted grey block, so the false claim flashed past as an unregisterable blink. Replacing it with a full hero (ghost cards, glow headline, call to action) turned that flicker into a confident lie, which is how it surfaced.

### Fix

All seven now branch `loading → skeleton → error → empty → list`.

---

## Lessons

1. **CSS 3D perspective over fine-line texture cannot be made to work in WKWebView.** The compositor owns the rasterisation. Two separate fixes were attempted before replacing the technique; the second fix was the right call and should have been the first.
2. **A missing CSS class fails silently.** `Stats.jsx` referenced `neon-text-yellow` and `neon-border-yellow` from the day it was written while neither existed anywhere, so the Top Genre card rendered with no glow beside two siblings that had it. Nothing errored, nothing warned. Same failure mode as an interpolated Tailwind class name being purged.
3. **Making a state more prominent exposes every latent bug in when that state shows.** The loading-guard family had been shipping for months behind a design too quiet to notice it. A better empty state is also a better bug detector.
4. **Patching one branch and matching its shape is not the same as checking the siblings.** The watched tabs were guarded, so they were copied — without checking that `to_watch` and `timeline` had the same structure. They did not. Audit every sibling branch of a conditional, not just the one being edited.
5. **Verify on the real target.** Every bug here was invisible in desktop Chrome. Headless screenshots did earn their keep once — they produced the measurement that exposed the density problem — but the device is the only authority on whether an iOS rendering bug is fixed.

## Victories

- Root-caused a rendering bug that had survived one prior fix attempt, and replaced the technique rather than patching it a third time.
- Grid density is now orientation-stable and derived rather than hardcoded (8 lanes across, both orientations).
- Empty and loading states designed across 6 library/watchlist states, 3 loading states, 4 timelines and the friends list, reusing one component rather than a parallel implementation per surface.
- Three latent bugs found and fixed that nobody had reported: the missing yellow neon classes, the seven unguarded loading paths, and framer-motion glow blobs ignoring `prefers-reduced-motion` entirely.
- `DESIGN.md` written and linked from `CLAUDE.md` / `AGENTS.md`, so the constraints above are enforced on the next surface instead of rediscovered.
