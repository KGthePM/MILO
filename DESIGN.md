# MILO Design Language

How MILO is supposed to look and feel, and the constraints any new surface has to survive. This exists because the visual layer is a feature, not decoration — it is most of what distinguishes MILO from a spreadsheet with an API key.

Read this before building any new UI. `CLAUDE.md` / `AGENTS.md` cover architecture; this covers intent.

---

## 1. The palette is a system, not a mood

Four accents, each permanently bound to a content type:

| Accent | Token | Owns |
|---|---|---|
| Cyan | `neon-cyan` `#00d4ff` | Movies |
| Magenta | `neon-magenta` `#ff006e` | TV |
| Purple | `neon-purple` `#8338ec` | Podcasts |
| Orange | `neon-orange` `#ff7a18` | Books |
| Yellow | `neon-yellow` `#ffbe0b` | Accent only — never a content type |

**Never pick an accent by hand.** `utils/contentTypes.js` is the source of truth: `accentFor(type)` returns the `ACCENT` entry, `iconFor(type)` returns the icon. Every class string in `ACCENT` is spelled out in full because Tailwind's extractor cannot resolve `` `text-${accent}` `` — a computed class name is silently purged from the production build and you get an unstyled element in prod that looked fine in dev.

That failure is not hypothetical: `Stats.jsx` referenced `neon-text-yellow` and `neon-border-yellow` for a long time while neither class existed anywhere, so the "Top Genre" card rendered with no glow next to two siblings that had it, and nothing errored.

**Rule:** a new accent-varying class goes into the `ACCENT` map as a complete literal string, or it doesn't exist.

## 2. Surfaces

- `.glass` — translucent white at 5%, `backdrop-filter: blur(10px)`, hairline white border. The app's only backdrop-filter. It is expensive over *moving* backdrops (it recomposites every frame), so think before putting animation behind it.
- `.neon-border-*` — a 1px border plus outer and inset glow. The standard card edge.
- `.neon-text-*` — three stacked text-shadows at 10/20/30px. Reserve it for headlines and numbers; it is illegible on body copy.
- Depth comes from glow and translucency, never from drop shadows or borders that read as "material."
- **`content-visibility: auto` clips.** It implies paint containment, so anything a descendant paints outside the padding edge — a marker dot straddling a rule, a `.neon-border-*` glow, a badge hanging off a corner — is sheared off. The timeline's date dots shipped as half-moons for exactly this reason. Put the containment on an inner wrapper holding the expensive content, and leave the overhanging decoration on the uncontained parent.

## 3. Motion

Motion earns its place by explaining something — where a thing came from, that content is arriving, that a state changed. Ambient motion is allowed exactly where it sets a mood and nothing is being read (the sign-in backdrop). It is not allowed behind a list someone is scanning.

**Hard constraints, all learned from iOS regressions:**

- **Animate `transform` and `opacity` only.** Anything else repaints.
- **Never animate a CSS 3D perspective over fine-line texture.** WebKit rasterizes a 3D-transformed layer once into a fixed backing store and then magnifies that bitmap, so hairlines degrade into a colour wash after a second or two, re-sharpening only on an orientation change. This is what killed the original sign-in horizon; the replacement draws on a canvas (`utils/neonHorizon.js`). See the `.auth-backdrop` comment in `index.css`.
- **Cap the count of simultaneous infinite animations.** Commit `bf98bb8` had to undo an unbounded entrance stagger plus a per-item infinite pulse that starved the WKWebView main thread and ate navigation taps. One sweep per skeleton *card*, not per bar. Cap entrance staggers around 0.35–0.4s total.
- **Cap DPR at 2** for canvas work. iPhone Pro reports 3 and line art gains nothing visible from it.
- **Pause loops when hidden** — `visibilitychange`, plus the Capacitor `appStateChange` listener on native.

**Every motion needs a reduced-motion path.** The `prefers-reduced-motion` block at the bottom of `index.css` covers CSS animation; framer-motion is invisible to it and needs `useReducedMotion()` at the component (the sign-in glow blobs looped through the OS setting for months because of exactly this gap). Canvas work checks `prefersReducedMotion()` and renders one settled frame without ever starting a loop.

## 4. The moments that matter

Most screens are utilities. A few are the product, and they get disproportionate care:

- **First launch / sign-in.** The one screen every user sees before they have any data. It is allowed to be the showpiece: canvas deep-field, wordmark power-on, warp-out on a real sign-in. The warp fires only on a *watched* sign-in — never on session restore or token refresh, which would tax every launch for a flourish nobody asked for. The warp runs about 2.4s, and a tap skips straight to the flash. During the cruise, a few neon line-art easter eggs (road signs, a VHS tape, a lost remote…) fly past at the edges, drawn on the same canvas. The sign-in and landing backdrops open with a burst of three eggs as the grid powers on, then let one drift by every 5–9s while idle. Eggs stay in the periphery, use a content-type accent only on the egg that stands for that type, and never nod to a real brand.
- **The intro reel.** `components/onboarding/OnboardingReel.jsx`. It plays right after that first sign-in, over the same deep field, so the warp lands inside it. It sells ideas rather than touring live UI, because a new user's library is empty and there's nothing to point at yet. The per-feature "you are here" moments belong to `DiscoveryHint`: one sentence in the flow of the page, dismissed forever. Keep hints rare; four exist, and each one has to explain something the UI can't say for itself.
- **Empty states.** The screen a brand-new user hits immediately after that. `components/shared/EmptyState.jsx`. A dead end becomes an invitation: flat accent grid, ghost cards hinting at what will land there, one clear action.
- **Loading.** `components/shared/SkeletonGrid.jsx`. Skeletons in the real card's shape, not a spinner — "your library is arriving" rather than "the app is busy," and no layout jump when data lands.

## 5. Copy

Short, concrete, quietly cinematic. Never cute, never exclamation-marked.

> "Your reel is empty — log the first film and MILO starts learning what you actually love."

not

> "No movies found. Add your first movie to get started!"

**Say the right thing for the actual situation.** An empty grid means two different things wearing the same words: *you have nothing yet* (wants an invitation to add) and *your filters matched nothing* (wants a way back out). Showing "Add your first movie" to someone with 300 films and a bad search term is just wrong. `EmptyState`'s `variant` prop splits them; pages compute `filtersActive` and pass `filtered`.

Podcasts say **Listened / To Listen**, movies and TV say **Watched / To Watch** — from `CONTENT_TYPES[key].verb`. The stored `status` is `'watched'` either way; only the label differs, and changing the stored value would drop podcasts out of every AI feature.

## 6. Before you ship a surface

- Accent pulled from the registry, not hardcoded.
- Every conditional class a complete literal string.
- Reduced-motion path exists, and covers framer-motion as well as CSS.
- Animated-layer count is bounded and loops pause when hidden.
- Empty, loading, and error states all designed — not just the happy path.
- **Every empty state is gated on the *initial* fetch first.** A list is `[]` before its fetch lands, so an ungated empty state asserts "you have nothing" to someone who has plenty. Seven tabs shipped this way for months because the old empty state was too quiet to notice it — a better empty state is also a better bug detector. Check the *sibling* branches of a conditional too, not just the one being edited; the watched tabs were guarded and the watchlist and timeline tabs next to them were not. A `loading` flag that starts `false` is the same bug wearing a guard: the first paint happens before the effect fires, so `!loading && items.length === 0` is momentarily true for everyone — this is what made Friends announce "No one here yet" on every visit. Start it `true` whenever mount triggers a fetch, and keep a separate `hasLoaded` so post-mutation refreshes don't tear down a list that is already on screen.
- **Tab and filter rows fit the narrowest phone.** A row that hugs its content (`inline-flex`, `w-fit`) silently pushes its last tab past the right edge once a fourth option or a longer label arrives — Timeline lost "Podcasts" that way. On small screens make it a full-width segmented control: `flex-1 min-w-0` per button, tighter padding, `truncate` on the label; restore the hug from `sm:` up.
- Checked in **portrait and landscape** on a real device. WKWebView is the target, not desktop Chrome; the bug that prompted this document was invisible everywhere else.
