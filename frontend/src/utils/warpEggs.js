// Easter eggs that fly past in the periphery of the neon deep-field — a few
// during the sign-in warp, and (where the caller opts in) an occasional slow
// drift-by while the backdrop idles. Driven by utils/neonHorizon.js; nothing
// here owns a loop or touches the DOM.
//
// Everything is canvas line art using the same fake-bloom trick as the grid:
// a wide dim stroke under a thin bright one. Never shadowBlur — it is
// pathologically slow in WKWebView (see drawFloor in neonHorizon.js).
//
// Each egg draws in its own local units (roughly 100 across) with the context
// already translated to its anchor and scaled by `s` pixels per unit, so line
// widths are divided by `s` to stay a constant on-screen thickness. Floor eggs
// anchor at the point where they stand on the grid; sky eggs at their centre.
//
// Accents follow DESIGN.md: a content-type colour appears only on the egg that
// stands for that type. Signs and the cat are neutral. Nods only — no
// trademarks, logos, or real brands.

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

const WHITE = [225, 250, 255];
const CYAN = [0, 212, 255];         // Movies
const MAGENTA = [255, 40, 140];     // TV (neon-magenta, lifted a touch for line art)
const PURPLE = [170, 120, 255];     // Podcasts (neon-purple is too dim as a hairline)
const ORANGE = [255, 122, 24];      // Books

const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

// Stroke the current path twice — wide and dim, then thin and bright.
function glow(ctx, s, c) {
  ctx.strokeStyle = rgba(c, 0.22);
  ctx.lineWidth = 3.5 / s;
  ctx.stroke();
  ctx.strokeStyle = rgba(c, 0.95);
  ctx.lineWidth = 1.2 / s;
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, c, align = 'center') {
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(c, 0.95);
  ctx.fillText(str, x, y);
}

// Dark backing so a label stays legible over the streaking starfield. Drawn
// source-over (the rest of the scene composites 'lighter').
function backing(ctx, x, y, w, h, r) {
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(4, 8, 22, 0.78)';
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.globalCompositeOperation = op;
}

// --- Highway signs ------------------------------------------------------------
// Measured once per sign (measureText ignores the transform, so the widths are
// already in local units) and cached on the egg.
function sign(id, lines, { colors, rare = false } = {}) {
  let layout = null;
  return {
    id,
    kind: 'floor',
    rare,
    draw(ctx, s) {
      if (!layout) {
        let maxW = 0;
        for (const l of lines) {
          ctx.font = `700 ${l.size}px ${FONT}`;
          maxW = Math.max(maxW, ctx.measureText(l.t).width);
        }
        const lineH = lines.map((l) => l.size * 1.25);
        const panelW = Math.max(maxW + 16, 48);
        const panelH = lineH.reduce((a, b) => a + b, 0) + 10;
        layout = { panelW, panelH, lineH };
      }
      const { panelW, panelH, lineH } = layout;
      const post = 22;
      const top = -post - panelH;
      const left = -panelW / 2;

      ctx.beginPath();
      ctx.moveTo(-panelW * 0.28, 0); ctx.lineTo(-panelW * 0.28, -post);
      ctx.moveTo(panelW * 0.28, 0); ctx.lineTo(panelW * 0.28, -post);
      glow(ctx, s, WHITE);

      backing(ctx, left, top, panelW, panelH, 4);
      ctx.beginPath();
      roundRect(ctx, left, top, panelW, panelH, 4);
      glow(ctx, s, WHITE);

      let y = top + 5;
      lines.forEach((l, i) => {
        y += lineH[i] / 2;
        text(ctx, l.t, 0, y, l.size, (colors && colors[i]) || WHITE);
        y += lineH[i] / 2;
      });
    },
  };
}

// --- Sky objects ----------------------------------------------------------------
const vhs = {
  id: 'vhs',
  kind: 'sky',
  draw(ctx, s) {
    backing(ctx, -36, -22, 72, 44, 4);
    ctx.beginPath();
    roundRect(ctx, -36, -22, 72, 44, 4);
    // Reels and the tape window between them.
    ctx.moveTo(-9, 4); ctx.arc(-16, 4, 7, 0, Math.PI * 2);
    ctx.moveTo(23, 4); ctx.arc(16, 4, 7, 0, Math.PI * 2);
    ctx.moveTo(-26, -5); ctx.lineTo(26, -5); ctx.lineTo(26, 14); ctx.lineTo(-26, 14); ctx.closePath();
    glow(ctx, s, CYAN);
    text(ctx, 'BE KIND, REWIND', 0, -13, 7, WHITE);
  },
};

const popcorn = {
  id: 'popcorn',
  kind: 'sky',
  draw(ctx, s, t) {
    ctx.beginPath();
    // Bucket: a tapered box with stripes.
    ctx.moveTo(-22, -6); ctx.lineTo(-16, 32); ctx.lineTo(16, 32); ctx.lineTo(22, -6); ctx.closePath();
    ctx.moveTo(-7, -6); ctx.lineTo(-5, 32);
    ctx.moveTo(7, -6); ctx.lineTo(5, 32);
    // Heaped kernels.
    for (let i = 0; i < 5; i++) {
      const x = -16 + i * 8;
      const y = -9 - (i % 2) * 5;
      ctx.moveTo(x + 6, y); ctx.arc(x, y, 6, 0, Math.PI * 2);
    }
    glow(ctx, s, CYAN);
    // A few escapees drifting off the top.
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1;
      const x = -14 + i * 14 + Math.sin(t * 2 + i) * 4;
      const y = -22 - k * 34;
      ctx.moveTo(x + 3.5, y); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    }
    glow(ctx, s, WHITE);
  },
};

const remote = {
  id: 'remote',
  kind: 'sky',
  draw(ctx, s) {
    ctx.beginPath();
    roundRect(ctx, -11, -36, 22, 72, 8);
    ctx.moveTo(4, -26); ctx.arc(0, -26, 4, 0, Math.PI * 2);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const x = -4.5 + c * 9, y = -10 + r * 10;
        ctx.moveTo(x + 2.5, y); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      }
    }
    // String out to a luggage tag.
    ctx.moveTo(11, -30); ctx.quadraticCurveTo(24, -38, 28, -26);
    glow(ctx, s, MAGENTA);
    backing(ctx, 22, -26, 44, 16, 3);
    ctx.beginPath();
    ctx.moveTo(28, -26); ctx.lineTo(66, -26); ctx.lineTo(66, -10); ctx.lineTo(28, -10); ctx.lineTo(22, -18); ctx.closePath();
    glow(ctx, s, WHITE);
    text(ctx, 'found it!', 46, -18, 7.5, WHITE);
  },
};

const mic = {
  id: 'mic',
  kind: 'sky',
  draw(ctx, s) {
    ctx.beginPath();
    roundRect(ctx, -12, -34, 24, 40, 12);
    for (let i = 0; i < 3; i++) { ctx.moveTo(-8, -22 + i * 8); ctx.lineTo(8, -22 + i * 8); }
    // Yoke, stand, base.
    ctx.moveTo(-17, -10); ctx.arc(0, -10, 17, Math.PI, 0, true);
    ctx.moveTo(0, 7); ctx.lineTo(0, 22);
    ctx.moveTo(-12, 22); ctx.lineTo(12, 22);
    glow(ctx, s, PURPLE);
    // Speech bubble.
    backing(ctx, 18, -52, 62, 26, 6);
    ctx.beginPath();
    roundRect(ctx, 18, -52, 62, 26, 6);
    ctx.moveTo(26, -26); ctx.lineTo(20, -18); ctx.lineTo(34, -26);
    glow(ctx, s, WHITE);
    text(ctx, '…anyway,', 49, -44, 7.5, WHITE);
    text(ctx, 'sponsor break', 49, -34, 7.5, WHITE);
  },
};

const book = {
  id: 'book',
  kind: 'sky',
  draw(ctx, s) {
    backing(ctx, -26, -34, 52, 68, 3);
    ctx.beginPath();
    roundRect(ctx, -26, -34, 52, 68, 3);
    ctx.moveTo(-19, -34); ctx.lineTo(-19, 34);
    ctx.moveTo(-10, -22); ctx.lineTo(18, -22);
    ctx.moveTo(-10, -15); ctx.lineTo(12, -15);
    glow(ctx, s, ORANGE);
    // Library due-date stamp, slapped on crooked.
    ctx.save();
    ctx.translate(4, 12);
    ctx.rotate(-0.22);
    ctx.beginPath();
    roundRect(ctx, -19, -8, 38, 16, 2);
    glow(ctx, s, WHITE);
    text(ctx, 'DUE 1987', 0, 0.5, 7.5, WHITE);
    ctx.restore();
  },
};

const astroCat = {
  id: 'astro-cat',
  kind: 'sky',
  spin: true,
  draw(ctx, s) {
    ctx.beginPath();
    // Backpack, then the helmet over it.
    roundRect(ctx, -18, 8, 36, 24, 6);
    ctx.moveTo(24, -4); ctx.arc(0, -4, 24, 0, Math.PI * 2);
    glow(ctx, s, WHITE);
    ctx.beginPath();
    // Head, ears, whiskers.
    ctx.moveTo(13, 0); ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.moveTo(-11, -7); ctx.lineTo(-9, -19); ctx.lineTo(-2, -12);
    ctx.moveTo(11, -7); ctx.lineTo(9, -19); ctx.lineTo(2, -12);
    ctx.moveTo(-6, 5); ctx.lineTo(-20, 3); ctx.moveTo(-6, 7); ctx.lineTo(-20, 9);
    ctx.moveTo(6, 5); ctx.lineTo(20, 3); ctx.moveTo(6, 7); ctx.lineTo(20, 9);
    glow(ctx, s, CYAN);
    ctx.fillStyle = rgba(WHITE, 0.95);
    ctx.beginPath();
    ctx.arc(-5, -2, 1.8, 0, Math.PI * 2);
    ctx.moveTo(6.8, -2);
    ctx.arc(5, -2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Helmet glint.
    ctx.beginPath();
    ctx.arc(0, -4, 19, -2.5, -1.9);
    glow(ctx, s, WHITE);
  },
};

const clapper = {
  id: 'clapper',
  kind: 'sky',
  draw(ctx, s, t) {
    backing(ctx, -30, -12, 60, 40, 3);
    ctx.beginPath();
    roundRect(ctx, -30, -12, 60, 40, 3);
    glow(ctx, s, CYAN);
    // The clap stick snaps shut on a loop.
    const open = Math.max(0, Math.sin(t * 5)) * 0.45;
    ctx.save();
    ctx.translate(-30, -12);
    ctx.rotate(-open);
    ctx.beginPath();
    ctx.rect(0, -9, 60, 9);
    for (let i = 0; i < 4; i++) { ctx.moveTo(8 + i * 14, -9); ctx.lineTo(14 + i * 14, 0); }
    glow(ctx, s, CYAN);
    ctx.restore();
    text(ctx, 'TAKE 47', 0, 3, 9, WHITE);
    text(ctx, 'SCENE: ???', 0, 16, 6.5, WHITE);
  },
};

const filmReel = {
  id: 'film-reel',
  kind: 'sky',
  spin: true,
  draw(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(26, 0); ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.moveTo(5, 0); ctx.arc(0, 0, 5, 0, Math.PI * 2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.cos(a) * 15, y = Math.sin(a) * 15;
      ctx.moveTo(x + 6, y); ctx.arc(x, y, 6, 0, Math.PI * 2);
    }
    glow(ctx, s, CYAN);
  },
};

const retroTv = {
  id: 'retro-tv',
  kind: 'sky',
  draw(ctx, s) {
    backing(ctx, -34, -22, 68, 48, 6);
    ctx.beginPath();
    roundRect(ctx, -34, -22, 68, 48, 6);
    roundRect(ctx, -28, -16, 46, 36, 5);
    ctx.moveTo(28, -8); ctx.arc(26, -8, 2, 0, Math.PI * 2);
    ctx.moveTo(28, 2); ctx.arc(26, 2, 2, 0, Math.PI * 2);
    // Rabbit ears and little feet.
    ctx.moveTo(-4, -22); ctx.lineTo(-16, -40);
    ctx.moveTo(4, -22); ctx.lineTo(14, -42);
    ctx.moveTo(-24, 26); ctx.lineTo(-26, 32);
    ctx.moveTo(24, 26); ctx.lineTo(26, 32);
    glow(ctx, s, MAGENTA);
    text(ctx, 'Still', -5, -6, 8, WHITE);
    text(ctx, 'watching?', -5, 6, 8, WHITE);
  },
};

const headphones = {
  id: 'headphones',
  kind: 'sky',
  draw(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-24, 6); ctx.arc(0, 6, 24, Math.PI, 0);
    roundRect(ctx, -30, 2, 12, 22, 5);
    roundRect(ctx, 18, 2, 12, 22, 5);
    glow(ctx, s, PURPLE);
    backing(ctx, -18, 30, 36, 14, 7);
    ctx.beginPath();
    roundRect(ctx, -18, 30, 36, 14, 7);
    glow(ctx, s, WHITE);
    text(ctx, '1.75×', 0, 37, 8, WHITE);
  },
};

const bookStack = {
  id: 'book-stack',
  kind: 'sky',
  draw(ctx, s) {
    ctx.beginPath();
    roundRect(ctx, -30, 14, 60, 12, 2);
    roundRect(ctx, -24, 2, 50, 12, 2);
    roundRect(ctx, -28, -10, 54, 12, 2);
    roundRect(ctx, -20, -22, 44, 12, 2);
    roundRect(ctx, -26, -34, 50, 12, 2);
    glow(ctx, s, ORANGE);
    backing(ctx, -24, 30, 48, 14, 3);
    text(ctx, 'TBR: 412', 0, 37, 8, WHITE);
  },
};

const ufo = {
  id: 'ufo',
  kind: 'sky',
  draw(ctx, s, t) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 9, 0, 0, Math.PI * 2);
    ctx.moveTo(14, -4); ctx.arc(0, -4, 14, 0, Math.PI, true);
    glow(ctx, s, WHITE);
    // Tractor beam, lifting a stray popcorn kernel.
    ctx.beginPath();
    ctx.moveTo(-10, 8); ctx.lineTo(-22, 50);
    ctx.moveTo(10, 8); ctx.lineTo(22, 50);
    glow(ctx, s, CYAN);
    const k = 44 - ((t * 18) % 36);
    ctx.beginPath();
    ctx.moveTo(4, k); ctx.arc(0, k, 4, 0, Math.PI * 2);
    glow(ctx, s, WHITE);
  },
};

const POOL = [
  sign('speed-limit', [{ t: 'SPEED', size: 8 }, { t: 'LIMIT', size: 8 }, { t: '88', size: 22 }]),
  sign('last-exit', [{ t: 'LAST EXIT', size: 9 }, { t: 'BEFORE SPOILERS', size: 9 }]),
  sign('now-leaving', [{ t: 'NOW LEAVING', size: 7 }, { t: 'YOUR WATCHLIST', size: 10 }]),
  sign('no-skipping', [{ t: 'NO SKIPPING', size: 9 }, { t: 'THE INTRO', size: 9 }]),
  sign('buffering', [{ t: 'BUFFERING…', size: 10 }, { t: 'jk', size: 8 }]),
  sign('plot-twist', [{ t: 'CAUTION', size: 8 }, { t: 'PLOT TWIST AHEAD', size: 9 }]),
  sign('one-more', [{ t: 'ONE MORE EPISODE', size: 9 }, { t: 'NEXT 40 EXITS', size: 7 }]),
  sign('third-act', [{ t: 'WELCOME TO', size: 7 }, { t: 'THE THIRD ACT', size: 10 }]),
  sign('book-better', [{ t: 'THE BOOK', size: 9 }, { t: 'WAS BETTER →', size: 9 }]),
  sign('sequel', [{ t: 'ROAD CLOSED', size: 9 }, { t: 'FOR SEQUEL', size: 8 }]),
  vhs, popcorn, remote, mic, book, astroCat,
  clapper, filmReel, retroTv, headphones, bookStack, ufo,
];

// MILO's own wordmark colours: YOU ARE in cyan, HERE in magenta.
const RARE = sign('you-are-here', [{ t: 'YOU ARE', size: 9 }, { t: 'HERE ●', size: 13 }], {
  colors: [CYAN, MAGENTA],
  rare: true,
});
const RARE_ODDS = 1 / 25;

// --- Flight path ----------------------------------------------------------------
// Depth runs exponentially from Z_START to Z_END, so on-screen size grows at a
// steady rate — labels are readable through the middle of the flight before
// the last stretch whooshes past the edge. Z_MID is where the egg sits at its
// "reading" position: PERIPHERY of the way out from centre, MID_WIDTH_FRAC of
// the viewport wide.
const Z_START = 18;
const Z_END = 1.2;
const Z_MID = 3;
const PERIPHERY = 0.7;
const MID_WIDTH_FRAC = 0.22;

// Warp: six eggs through launch and cruise, alternating sides, the last
// landing before the exit flash. Timings are fractions of the caller's warp
// duration. Flights overlap, but an egg is tiny for its first half, so only
// two or three are ever big enough to read at once.
const WARP_SLOTS = [0.12, 0.20, 0.28, 0.36, 0.44, 0.52];
const WARP_FLIGHT = 0.44;

// Opening burst: attention is shortest in the first few seconds, so the page
// opens with three quick eggs while the grid powers on, rather than making
// people wait for the first drift-by. Offsets from the first frame.
const BURST_AT_MS = [700, 1300, 1900];
const BURST_FLIGHT_MS = 2400;
const BURST_ALPHA = 0.85;

// Idle: one at a time after the burst.
const IDLE_AFTER_BURST_MS = [6500, 8000];
const IDLE_GAP_MS = [5000, 9000];
const IDLE_FLIGHT_MS = 3600;
const IDLE_ALPHA = 0.7;

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * @param {{idle?: boolean}} [options]
 */
export function createEggDirector({ idle = false } = {}) {
  let bag = [];
  let flights = [];
  let side = Math.random() < 0.5 ? -1 : 1;
  let nextIdleAt = 0;
  let warped = false;

  // Shuffle-bag, shared by idle and warp, so nothing repeats until the whole
  // pool has been seen.
  function nextEgg() {
    if (!bag.length) {
      bag = POOL.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function launch(egg, start, dur, alpha) {
    side = -side;
    flights.push({ egg, start, dur, alpha, side, phase: Math.random() * Math.PI * 2 });
  }

  return {
    startWarp(now, warpMs) {
      warped = true;
      const rareSlot = Math.random() < RARE_ODDS ? 3 : -1;  // mid-cruise, when it is easiest to catch
      WARP_SLOTS.forEach((at, i) => {
        launch(i === rareSlot ? RARE : nextEgg(), now + at * warpMs, WARP_FLIGHT * warpMs, 1);
      });
    },

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} now
     * @param {{cx: number, vpY: number, f: number, fEff: number, w: number, h: number, camY: number, alpha: number}} view
     */
    draw(ctx, now, view) {
      if (idle && !warped) {
        if (!nextIdleAt) {
          for (const at of BURST_AT_MS) launch(nextEgg(), now + at, BURST_FLIGHT_MS, BURST_ALPHA);
          nextIdleAt = now + rand(IDLE_AFTER_BURST_MS[0], IDLE_AFTER_BURST_MS[1]);
        } else if (now >= nextIdleAt && !flights.length) {
          launch(nextEgg(), now, IDLE_FLIGHT_MS, IDLE_ALPHA);
          nextIdleAt = now + rand(IDLE_GAP_MS[0], IDLE_GAP_MS[1]);
        }
      }
      if (!flights.length) return;

      const { cx, vpY, f, fEff, w, h, camY } = view;
      const sMid = clamp(w * MID_WIDTH_FRAC, 70, 150) / 100;
      const xMid = (PERIPHERY * (w / 2) * Z_MID) / f;
      // Sky eggs ride a third of the way up the space above the horizon.
      const yMidSky = (-0.33 * vpY * Z_MID) / f;

      for (let i = flights.length - 1; i >= 0; i--) {
        const fl = flights[i];
        const u = (now - fl.start) / fl.dur;
        if (u >= 1) { flights.splice(i, 1); continue; }
        if (u < 0) continue;

        const z = Z_START * Math.pow(Z_END / Z_START, u);
        const k = fEff / z;
        const t = (now - fl.start) / 1000;
        const sky = fl.egg.kind === 'sky';
        const sx = cx + fl.side * xMid * k;
        const sy = sky
          ? vpY + yMidSky * k + Math.sin(t * 1.7 + fl.phase) * 4
          : vpY + camY * k;
        const s = (sMid * Z_MID) / z;
        if (sx < -s * 90 || sx > w + s * 90 || sy < -s * 90 || sy > h + s * 90) continue;

        ctx.save();
        ctx.globalAlpha = view.alpha * fl.alpha * clamp(u / 0.18, 0, 1);
        ctx.translate(sx, sy);
        if (sky) {
          // Lazy tumble; the astronaut cat gets a proper spin.
          const rot = fl.egg.spin ? t * 1.3 * fl.side : Math.sin(t * 1.1 + fl.phase) * 0.28;
          ctx.rotate(rot);
        }
        ctx.scale(s, s);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        fl.egg.draw(ctx, s, t);
        ctx.restore();
      }
    },
  };
}
