// Decodes string-array pixel art into offscreen canvases once at boot, so the
// hot path is a plain drawImage. Also provides the tint / silhouette / outline
// variants the entities need for hit flashes and rim lighting.

import { PAL } from '../data/palette.js';

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return c;
}

/** Decode rows of palette characters into a canvas. */
export function decode(rows, key) {
  if (key && cache.has(key)) return cache.get(key);
  const h = rows.length;
  const w = rows[0].length;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const hex = PAL[row[x]];
      if (!hex) continue;
      const i = (y * w + x) * 4;
      d[i]     = parseInt(hex.slice(1, 3), 16);
      d[i + 1] = parseInt(hex.slice(3, 5), 16);
      d[i + 2] = parseInt(hex.slice(5, 7), 16);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (key) cache.set(key, c);
  return c;
}

/** Decode a whole animation table: { idle: [rows, rows], ... } -> { idle: [canvas, ...] } */
export function decodeSet(table, prefix) {
  const out = {};
  for (const name in table) {
    out[name] = table[name].map((rows, i) => decode(rows, `${prefix}:${name}:${i}`));
  }
  return out;
}

/** Horizontally mirrored copy — lets one side-facing sprite serve both directions. */
export function flipH(src, key) {
  if (key && cache.has(key)) return cache.get(key);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  if (key) cache.set(key, c);
  return c;
}

export function flipSet(set, prefix) {
  const out = {};
  for (const name in set) out[name] = set[name].map((c, i) => flipH(c, `${prefix}:${name}:${i}`));
  return out;
}

/** Solid-colour silhouette, used for hit flashes and the boss vanish ghost. */
export function silhouette(src, colour, key) {
  if (key && cache.has(key)) return cache.get(key);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, c.width, c.height);
  if (key) cache.set(key, c);
  return c;
}

/**
 * 1px outline in `colour`, drawn outside the existing silhouette. This is what
 * sells the rim-light on enemies against a dark room.
 */
export function outline(src, colour, key) {
  if (key && cache.has(key)) return cache.get(key);
  const c = makeCanvas(src.width + 2, src.height + 2);
  const ctx = c.getContext('2d');
  const sil = silhouette(src, colour);
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) ctx.drawImage(sil, dx, dy);
  ctx.drawImage(src, 1, 1);
  if (key) cache.set(key, c);
  return c;
}

/**
 * Draw a sprite centred on a world position, snapped to whole pixels. Snapping
 * matters: sub-pixel placement is what makes pixel art shimmer and look cheap.
 */
export function draw(ctx, sprite, cx, cy, opts = {}) {
  const { alpha = 1, flip = false, scale = 1 } = opts;
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);

  if (alpha !== 1) { ctx.save(); ctx.globalAlpha = alpha; }
  if (flip) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(sprite, x, y, w, h);
  }
  if (alpha !== 1) ctx.restore();
}
