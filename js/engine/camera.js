// Rooms are exactly one screen, so the camera never pans during play — it only
// shakes and pushes, and both decay smoothly so hits feel weighty without
// making play hard.
//
// It does zoom, but only for boss cutscenes. Zoom is a crop of the scene buffer
// rather than a transform, so the pixel grid stays exact at any scale.

import { VW, VH } from './canvas.js';

export const cam = {
  shakeX: 0, shakeY: 0, _mag: 0, _t: 0, pushX: 0, pushY: 0,
  zoom: 1, zoomX: VW / 2, zoomY: VH / 2,
};

// where the zoom is travelling from and to
const z = { from: 1, to: 1, fx: VW / 2, fy: VH / 2, tx: VW / 2, ty: VH / 2, t: 0, dur: 0 };

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Push in on a point over `dur` seconds. scale 1 is the whole room. */
export function zoomTo(x, y, scale, dur = 0.7) {
  z.from = cam.zoom; z.fx = cam.zoomX; z.fy = cam.zoomY;
  z.to = scale; z.tx = x; z.ty = y;
  z.t = 0; z.dur = Math.max(0.0001, dur);
}

/** Pull back out to the full room, keeping the current focus while it travels. */
export function zoomOut(dur = 0.6) {
  zoomTo(cam.zoomX, cam.zoomY, 1, dur);
}

export function zooming() { return z.t < z.dur; }

export function shake(magnitude, duration = 0.25) {
  cam._mag = Math.max(cam._mag, magnitude);
  cam._t = Math.max(cam._t, duration);
  cam._dur = cam._t;
}

/** A directional nudge, e.g. away from a dash impact. */
export function push(dx, dy, amount) {
  const l = Math.hypot(dx, dy) || 1;
  cam.pushX += (dx / l) * amount;
  cam.pushY += (dy / l) * amount;
}

export function update(dt) {
  if (z.t < z.dur) {
    z.t = Math.min(z.dur, z.t + dt);
    const k = easeInOut(z.t / z.dur);
    cam.zoom = z.from + (z.to - z.from) * k;
    cam.zoomX = z.fx + (z.tx - z.fx) * k;
    cam.zoomY = z.fy + (z.ty - z.fy) * k;
  }

  if (cam._t > 0) {
    cam._t -= dt;
    const k = Math.max(0, cam._t / (cam._dur || 1));
    const m = cam._mag * k * k;
    cam.shakeX = (Math.random() - 0.5) * 2 * m;
    cam.shakeY = (Math.random() - 0.5) * 2 * m;
    if (cam._t <= 0) { cam._mag = 0; cam.shakeX = cam.shakeY = 0; }
  } else {
    cam.shakeX = cam.shakeY = 0;
  }

  const decay = Math.pow(0.001, dt);
  cam.pushX *= decay;
  cam.pushY *= decay;
}

export function totalX() { return cam.shakeX + cam.pushX; }
export function totalY() { return cam.shakeY + cam.pushY; }

export function reset() {
  cam.shakeX = cam.shakeY = cam.pushX = cam.pushY = cam._mag = cam._t = 0;
  cam.zoom = 1;
  cam.zoomX = VW / 2;
  cam.zoomY = VH / 2;
  z.from = z.to = 1;
  z.fx = z.tx = VW / 2;
  z.fy = z.ty = VH / 2;
  z.t = z.dur = 0;
}
