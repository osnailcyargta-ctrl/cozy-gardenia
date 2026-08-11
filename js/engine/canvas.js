// Screen buffers and scaling.
//
// The scene is drawn at VW x VH with no smoothing so the pixel art stays exact.
// It is then blown up to the display canvas with nearest-neighbour, and the
// post-processing runs at *display* resolution — that combination is what gives
// crisp pixels with smooth cinematic light instead of chunky blocky glow.

export const TILE = 16;
export const VW = 480;   // 30 tiles
export const VH = 256;   // 16 tiles

function make(w, h, smooth = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = smooth;
  return { canvas: c, ctx: x };
}

/** Low-res scene buffer — tiles, entities, everything diegetic. */
export const scene = make(VW, VH);

/** Low-res additive light buffer, composited over the scene before upscale. */
export const lights = make(VW, VH, true);

export const screen = document.getElementById('screen');
export const sctx = screen.getContext('2d');

// The backing store and the on-screen size are deliberately separate.
//
// Post-processing cost is pure fill rate — it scales with backing-store pixels
// and nothing else. On a GPU a 4x buffer is free; under software rendering it
// is the whole frame budget. So we render at `scale` and let CSS stretch the
// result to `cssW/cssH`, which the compositor does for nothing, and let
// main.js raise or lower `scale` based on measured frame time.
export const view = { scale: 3, w: VW * 3, h: VH * 3, cssW: 0, cssH: 0, maxScale: 4 };

const STEPS = [1, 1.5, 2, 2.5, 3, 4];

export function resize() {
  const availW = window.innerWidth;
  const availH = window.innerHeight;

  const fit = Math.min(availW / VW, availH / VH);
  view.cssW = Math.round(VW * fit);
  view.cssH = Math.round(VH * fit);

  // never render more pixels than the display actually shows
  view.maxScale = STEPS.reduce((best, s) => (s <= fit + 0.001 ? s : best), 1);
  if (view.scale > view.maxScale) view.scale = view.maxScale;

  applyScale();
}

export function applyScale() {
  view.w = Math.round(VW * view.scale);
  view.h = Math.round(VH * view.scale);
  screen.width = view.w;
  screen.height = view.h;
  screen.style.width = view.cssW + 'px';
  screen.style.height = view.cssH + 'px';
  sctx.imageSmoothingEnabled = false;
}

/** Step the render scale up or down; returns true if it actually changed. */
export function nudgeScale(dir) {
  const i = STEPS.indexOf(view.scale);
  const cur = i === -1 ? 2 : i;
  let next = Math.max(0, Math.min(STEPS.length - 1, cur + dir));
  while (STEPS[next] > view.maxScale && next > 0) next--;
  if (STEPS[next] === view.scale) return false;
  view.scale = STEPS[next];
  applyScale();
  return true;
}

window.addEventListener('resize', resize);

/** Convert a mouse event to low-res buffer coordinates (CSS box, not backing store). */
export function toBuffer(ev) {
  const r = screen.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) / r.width * VW,
    y: (ev.clientY - r.top) / r.height * VH,
  };
}
