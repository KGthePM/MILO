// Synthwave deep-field backdrop — the sign-in screen's Tron horizon, redrawn
// on a <canvas> every frame instead of composited by CSS.
//
// WHY CANVAS (do not "simplify" this back into CSS):
// The previous implementation was a perspective-transformed div painted with
// 1px repeating-linear-gradients (.auth-horizon* in index.css, removed). On
// iOS that renders correctly for a second or two and then smears into a
// colour wash. WebKit promotes the transformed element to a composited layer,
// rasterises its *pre-transform* content once into a fixed-size backing store,
// then lets the perspective magnify that bitmap — so the hairlines nearest the
// viewer are a stretched cache, not real lines. Rotating the device
// invalidates the tiles, which is why the grid comes back sharp for a moment
// and then degrades again. Landscape is worst because the near-edge
// magnification ratio is highest there. There is no knob to raise the
// compositor's raster resolution; the technique itself is the bug.
//
// Projecting the perspective here in JS and stroking real lines at device
// pixel ratio removes the cached bitmap from the loop entirely. A resize
// becomes a buffer realloc, because every frame is drawn from scratch.
//
// This is the app's first requestAnimationFrame/canvas code. The caps below
// (DPR 2, 30fps on native) exist because of the regression class documented in
// commit bf98bb8 "Fix iOS nav lag" — piling simultaneous animation onto a
// WKWebView main thread starves touch handling.

import { IS_NATIVE } from './native';
import { createEggDirector } from './warpEggs';

// How long the sign-in warp-out runs. Exported so AuthGate's hand-off timer
// and the animation can never drift apart.
export const WARP_MS = 2400;

// The warp is a short sequence rather than a single ramp, as fractions of
// WARP_MS: a spool-down breath (charge), the jump (launch), sustained
// hyperspace where the easter eggs fly past (cruise), then the punch and
// white-out (exit).
const CHARGE_END = 0.12;
const LAUNCH_END = 0.30;
const EXIT_START = 0.86;
const CRUISE_SPEED = 18;

// A skipped warp jumps straight to the exit, so the flash still plays. AuthGate
// reschedules its hand-off to this.
export const WARP_SKIP_MS = Math.round(WARP_MS * (1 - EXIT_START));

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// --- World / projection constants ------------------------------------------
// Camera sits at the origin looking down -z, CAM_Y above the floor plane.
// Project with sx = vpX + x*f/z, sy = vpY + y*f/z.
const CAM_Y = 1.0;       // camera height above the grid floor, world units
const RUNG_CELL = 0.45;  // spacing between rungs, in world z
// Lane spacing is derived per-resize instead of fixed, so the grid keeps the
// same on-screen density in both orientations. A fixed world-space cell does
// not: the focal length scales with viewport *height*, so portrait magnified
// the grid to ~1.6 lanes across a phone while landscape showed ~7.
const LANES_ACROSS = 8;  // target vertical lines across the viewport, at the bottom edge
const Z_NEAR = 0.8;      // rungs nearer than this are already off the bottom
const Z_FAR = 14;        // grid fades to nothing here
const Z_FAR_STARS = 22;

const BOOT_MS = 1300;    // matches the 1.6s wordmark power-on in index.css

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Warp choreography for progress p in [0, 1]. speedMul scales the field's
// forward speed, trail stretches stars into streaks, dolly scales the focal
// length, roll tilts the whole scene (radians), flash is the white-out alpha.
function warpCurve(p) {
  if (p < CHARGE_END) {
    const e = Math.sin((p / CHARGE_END) * Math.PI / 2);
    return { speedMul: 1 - 0.7 * e, trail: 0.02, dolly: 1 - 0.04 * e, roll: 0, flash: 0 };
  }
  if (p < LAUNCH_END) {
    const q = (p - CHARGE_END) / (LAUNCH_END - CHARGE_END);
    const e = q * q * q;                     // easeInCubic — a real launch
    return {
      speedMul: 0.3 + (CRUISE_SPEED - 0.3) * e,
      trail: 0.02 + 1.08 * q * q,
      dolly: 0.96 + 0.1 * e,
      roll: 0,
      flash: 0,
    };
  }
  if (p < EXIT_START) {
    const q = (p - LAUNCH_END) / (EXIT_START - LAUNCH_END);
    // A slow barrel roll and a shimmer in the streaks, eased in and out so
    // cruise never reads as a frozen frame.
    const env = Math.sin(q * Math.PI);
    return {
      speedMul: CRUISE_SPEED,
      trail: 1.1 + 0.12 * Math.sin(q * Math.PI * 6),
      dolly: 1.06,
      roll: Math.sin(q * Math.PI * 2) * 0.025 * env,
      flash: 0,
    };
  }
  const q = clamp((p - EXIT_START) / (1 - EXIT_START), 0, 1);
  return {
    speedMul: CRUISE_SPEED + 8 * q * q,
    trail: 1.1 + 0.3 * q * q,
    dolly: 1.06 + 0.19 * q * q,
    roll: 0,
    flash: q > 0.3 ? Math.pow((q - 0.3) / 0.7, 2) * 0.85 : 0,
  };
}

// Star palette: mostly cool white, with the magenta/purple accents sprinkled
// in so the field reads as MILO's tri-accent rather than a generic starfield.
const STAR_COLORS = [
  [200, 240, 255], [200, 240, 255], [200, 240, 255],
  [200, 240, 255], [200, 240, 255], [170, 225, 255], [255, 255, 255],
  [255, 80, 160], [255, 80, 160],
  [170, 120, 255],
];

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{variant?: 'full'|'calm', fpsCap?: number, eggs?: 'idle'|false}} [options]
 *   eggs: 'idle' adds the occasional easter-egg drift-by while idling. The
 *   warp always gets its eggs.
 * @returns {{setPhase: (p: 'idle'|'warp') => void, skip: () => void, destroy: () => void}}
 */
export function createNeonHorizon(canvas, options = {}) {
  const variant = options.variant === 'calm' ? 'calm' : 'full';
  const calm = variant === 'calm';
  // Native idles at 30fps: the motion is dt-integrated so it looks identical,
  // but it halves how often the auth card's backdrop-filter has to recomposite.
  const idleFps = options.fpsCap || (IS_NATIVE ? 30 : 60);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return { setPhase() {}, skip() {}, destroy() {} };

  const reduced = prefersReducedMotion();
  // Never on the calm variant or under reduced motion (which draws one static
  // frame — an egg would freeze mid-flight).
  const eggs = createEggDirector({ idle: options.eggs === 'idle' && !calm && !reduced });

  // --- Mutable engine state -------------------------------------------------
  let w = 0, h = 0, dpr = 1;
  let vpX = 0, vpY = 0, f = 0;
  let lanes = 20, rungs = 24, laneCell = 0.3;
  let laneGrad = null, laneBloom = null, sunGrad = null;
  let stars = [];
  let starXR = 4, starYR = 4;
  let scroll = 0;            // rung offset within one cell, always [0, RUNG_CELL)
  let raf = 0, last = 0;
  let startedAt = 0;
  let phase = 'idle';
  let warpStart = 0;
  let parallaxTarget = 0, parallax = 0;
  let running = false;
  let destroyed = false;

  const baseSpeed = calm ? 0.9 : 1.6;   // world units per second

  // --- Sizing ---------------------------------------------------------------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nw = Math.max(1, Math.round(rect.width));
    const nh = Math.max(1, Math.round(rect.height));
    // Cap DPR at 2. An iPhone 15 Pro reports 3, which triples fill cost for
    // line art that gains nothing visible from it.
    const ndpr = Math.min(window.devicePixelRatio || 1, 2);
    if (nw === w && nh === h && ndpr === dpr) return;

    w = nw; h = nh; dpr = ndpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const landscape = w > h;
    vpX = w / 2;
    // Horizon a little above centre so the MILO wordmark sits just on top of it.
    vpY = h * (landscape ? 0.42 : 0.46);
    f = 0.9 * h;

    // On-screen lane spacing at the bottom edge works out to
    // laneCell * (h - vpY) / CAM_Y — the focal length cancels — so solving for
    // a target of LANES_ACROSS lines across the viewport pins the density to
    // screen width and keeps it stable through a rotation.
    laneCell = clamp((w / LANES_ACROSS) * CAM_Y / (h - vpY), 0.04, 1.5);
    // Enough lanes to still span the full width at the far plane, where
    // everything has converged toward the vanishing point.
    lanes = clamp(Math.ceil((w * Z_FAR) / (2 * laneCell * f)) + 2, 12, 70);
    rungs = Math.ceil((Z_FAR - Z_NEAR) / RUNG_CELL) + 2;

    buildGradients();
    seedStars();
  }

  // The lanes all converge on the vanishing point, so screen-y maps
  // monotonically to depth — one vertical gradient gives every lane the
  // correct horizon fade. Built per resize, never per frame.
  function buildGradients() {
    const dim = calm ? 0.55 : 1;
    const lane = (a) => `rgba(0, 212, 255, ${(a * dim).toFixed(3)})`;

    laneGrad = ctx.createLinearGradient(0, vpY, 0, h);
    laneGrad.addColorStop(0, lane(0));
    laneGrad.addColorStop(0.05, lane(0.10));
    laneGrad.addColorStop(0.25, lane(0.32));
    laneGrad.addColorStop(0.60, lane(0.55));
    laneGrad.addColorStop(1, lane(0.62));

    laneBloom = ctx.createLinearGradient(0, vpY, 0, h);
    laneBloom.addColorStop(0, lane(0));
    laneBloom.addColorStop(0.05, lane(0.02));
    laneBloom.addColorStop(0.25, lane(0.06));
    laneBloom.addColorStop(0.60, lane(0.10));
    laneBloom.addColorStop(1, lane(0.12));

    const r = Math.max(w, h) * 0.55;
    sunGrad = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, r);
    sunGrad.addColorStop(0, 'rgba(0, 212, 255, 0.30)');
    sunGrad.addColorStop(0.18, 'rgba(90, 120, 255, 0.14)');
    sunGrad.addColorStop(0.45, 'rgba(255, 0, 110, 0.07)');
    sunGrad.addColorStop(1, 'rgba(255, 0, 110, 0)');
  }

  function seedStars() {
    const area = w * h;
    const cap = calm ? 70 : 170;
    const count = clamp(Math.round(area / 5500), 30, cap);
    // Spread derived from the screen so the field frames the viewport at mid
    // depth rather than clustering in a fixed world-space box.
    const xr = (0.95 * (w / 2) * 8) / f;
    const yr = (0.95 * (h / 2) * 8) / f;
    stars = new Array(count);
    for (let i = 0; i < count; i++) stars[i] = spawnStar(xr, yr, true);
    starXR = xr; starYR = yr;
  }

  function spawnStar(xr, yr, scatter) {
    return {
      x: (Math.random() * 2 - 1) * xr,
      // Negative y is above the vanishing point. Capped just short of CAM_Y so
      // a star never spawns below the grid floor.
      y: -yr + Math.random() * (yr + CAM_Y - 0.15),
      z: scatter ? Z_NEAR + Math.random() * (Z_FAR_STARS - Z_NEAR) : Z_FAR_STARS,
      c: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0],
      s: 0.6 + Math.random() * 1.6,
    };
  }

  // --- Drawing --------------------------------------------------------------
  function draw(now) {
    const elapsed = now - startedAt;
    const bootP = reduced ? 1 : clamp(elapsed / BOOT_MS, 0, 1);

    let speedMul = 1;
    let trailFactor = 0.02;
    let fEff = f;
    let flash = 0;
    let roll = 0;
    if (phase === 'warp' && !reduced) {
      const c = warpCurve(clamp((now - warpStart) / WARP_MS, 0, 1));
      speedMul = c.speedMul;
      trailFactor = c.trail;
      fEff = f * c.dolly;
      flash = c.flash;
      roll = c.roll;
    }

    // Vanishing point drift. On the web the pointer drives it; on native the
    // pointer is under the card, so a very slow sine keeps it from reading as
    // a static loop. No DeviceOrientation — that needs a permission prompt.
    if (!reduced) {
      if (IS_NATIVE || calm) {
        parallax = Math.sin((now / 20000) * Math.PI * 2) * 10;
      } else {
        parallax += (parallaxTarget - parallax) * 0.06;
      }
    }
    const cx = vpX + parallax;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (roll) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(roll);
      ctx.translate(-w / 2, -h / 2);
    }

    // Horizon glow first, underneath the line art. The extra kick at boot is
    // the "power on" flare that syncs with the wordmark igniting.
    const flare = reduced ? 0 : Math.pow(1 - bootP, 2) * 1.8;
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(cx - vpX, 0);
    ctx.globalAlpha = clamp((calm ? 0.55 : 1) * (0.6 + flare), 0, 1);
    ctx.fillStyle = sunGrad;
    ctx.fillRect(-w, 0, w * 3, h);
    ctx.restore();

    // Everything below fades in together during boot.
    const bootAlpha = clamp(bootP * 2.5, 0, 1);

    drawHorizonLine(cx, bootAlpha, flare);
    drawFloor(cx, fEff, bootP, bootAlpha);
    drawStars(cx, fEff, trailFactor, bootAlpha);
    eggs.draw(ctx, now, { cx, vpY, f, fEff, w, h, camY: CAM_Y, alpha: bootAlpha });

    if (flash > 0) {
      // Untilted, so the white-out covers the corners even mid-roll.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(190, 245, 255, ${flash.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    return speedMul;
  }

  function drawHorizonLine(cx, bootAlpha, flare) {
    const a = clamp(bootAlpha * (0.45 + flare * 0.5), 0, 1);
    if (a <= 0) return;
    // Boot reveals the horizon line outward from the vanishing point.
    const spread = (0.25 + 0.75 * clamp(bootAlpha, 0, 1)) * w;
    ctx.globalAlpha = a;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(120, 230, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - spread, vpY);
    ctx.lineTo(cx + spread, vpY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(225, 250, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - spread, vpY);
    ctx.lineTo(cx + spread, vpY);
    ctx.stroke();
  }

  function drawFloor(cx, fEff, bootP, bootAlpha) {
    ctx.lineCap = 'butt';
    ctx.globalAlpha = bootAlpha;

    // --- Lanes: constant world x, running from the near plane to the horizon.
    // Two passes, wide-and-dim then thin-and-bright: additive layering fakes
    // the neon bloom. Canvas shadowBlur would do it "properly" and is
    // pathologically slow in WKWebView — never reach for it here.
    const yNear = vpY + (CAM_Y * fEff) / Z_NEAR;
    const yFar = vpY + (CAM_Y * fEff) / Z_FAR;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? laneBloom : laneGrad;
      ctx.lineWidth = pass === 0 ? 2.5 : 1;
      ctx.beginPath();
      for (let k = -lanes; k <= lanes; k++) {
        const x = k * laneCell;
        ctx.moveTo(cx + (x * fEff) / Z_NEAR, yNear);
        ctx.lineTo(cx + (x * fEff) / Z_FAR, yFar);
      }
      ctx.stroke();
    }

    // --- Rungs: constant world z, scrolling toward the viewer.
    const halfW = lanes * laneCell;
    // Boot reveals the grid from the horizon forward, so it rushes out at you.
    const revealZ = Z_FAR * (1 - bootP);
    for (let i = 0; i < rungs; i++) {
      const z = Z_NEAR + i * RUNG_CELL - scroll;
      if (z <= 0.05 || z > Z_FAR || z < revealZ) continue;
      const depth = 1 - z / Z_FAR;
      const a = Math.pow(depth, 1.6) * (calm ? 0.45 : 0.8);
      if (a < 0.004) continue;
      const y = vpY + (CAM_Y * fEff) / z;
      if (y > h + 4) continue;
      const dx = (halfW * fEff) / z;
      // Purple at depth warming to magenta up close — a free depth cue.
      const r = Math.round(131 + 124 * depth);
      const g = Math.round(56 - 56 * depth);
      const b = Math.round(236 - 126 * depth);
      ctx.beginPath();
      ctx.moveTo(cx - dx, y);
      ctx.lineTo(cx + dx, y);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(a * 0.18).toFixed(3)})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawStars(cx, fEff, trailFactor, bootAlpha) {
    ctx.lineCap = 'round';
    ctx.globalAlpha = bootAlpha;
    const trailLen = baseSpeed * trailFactor * 8;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const z = s.z;
      if (z <= 0.15) continue;
      const a = clamp(1 - z / Z_FAR_STARS, 0, 1);
      if (a < 0.02) continue;
      const x1 = cx + (s.x * fEff) / z;
      const y1 = vpY + (s.y * fEff) / z;
      const z2 = z + trailLen;
      const x2 = cx + (s.x * fEff) / z2;
      const y2 = vpY + (s.y * fEff) / z2;
      const c = s.c;
      // One code path for dots and hyperspace streaks: at idle the trail is
      // sub-pixel and the round line cap renders it as a point.
      ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(a * 0.9).toFixed(3)})`;
      ctx.lineWidth = clamp((fEff / z) * 0.004 * s.s, 0.5, 2.4);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  function advance(dt, speedMul) {
    const speed = baseSpeed * speedMul;
    scroll = (scroll + speed * dt) % RUNG_CELL;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.z -= speed * dt * 1.35;
      if (s.z <= Z_NEAR * 0.5) {
        const n = spawnStar(starXR, starYR, false);
        s.x = n.x; s.y = n.y; s.z = n.z; s.c = n.c; s.s = n.s;
      }
    }
  }

  // --- Loop -----------------------------------------------------------------
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const fps = phase === 'warp' ? 60 : idleFps;
    const interval = 1000 / fps - 1;
    const dtMs = now - last;
    if (dtMs < interval) return;
    last = now;
    // Clamp dt so a paused tab or a slow first frame can't teleport the field.
    const dt = clamp(dtMs / 1000, 0, 0.1);
    const speedMul = draw(now);
    advance(dt, speedMul);
  }

  function start() {
    if (running || destroyed || reduced) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // --- Wiring ---------------------------------------------------------------
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => { resize(); if (reduced) drawStatic(); })
    : null;
  ro?.observe(canvas);

  // iOS reports stale dimensions if you measure during orientationchange.
  const onOrientation = () => {
    setTimeout(() => { resize(); if (reduced) drawStatic(); }, 60);
  };

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  const onPointer = (e) => {
    parallaxTarget = (e.clientX / Math.max(1, w) - 0.5) * 26;
  };

  function drawStatic() {
    // Reduced motion: one settled frame, no loop, ever.
    startedAt = performance.now() - BOOT_MS;
    draw(performance.now());
  }

  let removeAppState = null;
  if (IS_NATIVE) {
    // Dynamic import so the Capacitor plugin never enters the web bundle graph
    // at module-eval time (see the header of utils/native.js).
    (async () => {
      const { App } = await import('@capacitor/app');
      const listener = await App.addListener('appStateChange', ({ isActive }) => {
        if (destroyed) return;
        if (isActive) start(); else stop();
      });
      removeAppState = () => listener.remove?.();
      if (destroyed) removeAppState();
    })().catch(() => {});
  }

  resize();
  startedAt = performance.now();
  if (reduced) {
    drawStatic();
  } else {
    window.addEventListener('orientationchange', onOrientation);
    document.addEventListener('visibilitychange', onVisibility);
    if (!IS_NATIVE && !calm) window.addEventListener('pointermove', onPointer, { passive: true });
    start();
  }

  return {
    setPhase(next) {
      if (next === phase) return;
      phase = next;
      if (next === 'warp') {
        warpStart = performance.now();
        eggs.startWarp(warpStart, WARP_MS);
      }
    },
    // Jump a running warp to its exit so the flash still plays.
    skip() {
      if (phase !== 'warp') return;
      warpStart = Math.min(warpStart, performance.now() - EXIT_START * WARP_MS);
    },
    destroy() {
      destroyed = true;
      stop();
      ro?.disconnect();
      window.removeEventListener('orientationchange', onOrientation);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      removeAppState?.();
    },
  };
}
