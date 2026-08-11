// Post-processing chain. Runs at display resolution, after the pixel buffer has
// been upscaled, so glow and fog are smooth while the sprites stay hard-edged.
//
// Order:  scene(+lights) -> upscale -> bloom -> fog -> vignette -> grain -> aberration

import { VW, VH, view } from './canvas.js';

export const FX = {
  bloom: true,
  bloomStrength: 0.55,
  bloomThreshold: 0.78,
  fog: true,
  fogStrength: 1,
  vignette: true,
  grain: true,
  aberration: true,
};

function buf(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d') };
}

// Bloom and fog run at fixed *scene*-scale resolution, never display scale.
// Both are low-frequency by nature, so nothing visible is lost, and the cost
// stops growing when the player maximises the window. The blur is a
// downsample/upsample chain rather than ctx.filter='blur()' — the filter is an
// order of magnitude slower wherever canvas isn't GPU-accelerated.
const BW = VW >> 1, BH = VH >> 1;          // 240 x 128
const bright = buf(BW, BH);
const half = buf(BW >> 1, BH >> 1);        // 120 x 64
const quarter = buf(BW >> 2, BH >> 2);     // 60 x 32
const fogBuf = buf(BW, BH);

let grainTile = null;
let fogTile = null;

/* ------------------------------------------------------------
   Static noise tiles, generated once
   ------------------------------------------------------------ */

function makeGrain() {
  const s = 128;
  const { c, x } = buf(s, s);
  const img = x.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const v = 118 + ((Math.random() * 74) | 0);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

/** Soft blobby fog: sparse blurred dots tiled seamlessly. */
function makeFog() {
  const s = 256;
  const { c, x } = buf(s, s);
  x.fillStyle = '#000';
  x.fillRect(0, 0, s, s);
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) {
    const px = Math.random() * s;
    const py = Math.random() * s;
    const r = 22 + Math.random() * 52;
    // draw 9x so the tile wraps without visible seams
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const g = x.createRadialGradient(px + ox * s, py + oy * s, 0, px + ox * s, py + oy * s, r);
        const a = 0.05 + Math.random() * 0.09;
        g.addColorStop(0, `rgba(150,140,190,${a})`);
        g.addColorStop(1, 'rgba(150,140,190,0)');
        x.fillStyle = g;
        x.beginPath();
        x.arc(px + ox * s, py + oy * s, r, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  return c;
}

/* ------------------------------------------------------------
   Main entry
   ------------------------------------------------------------ */

let t = 0;

/**
 * @param sctx    display context
 * @param sceneC  low-res scene canvas (lights already composited in)
 * @param dt      seconds
 * @param mood    per-room tuning: { fog, fogColor, vignette, tint }
 */
export function present(sctx, sceneC, dt, mood = {}) {
  t += dt;
  const W = view.w, H = view.h;
  if (!grainTile) grainTile = makeGrain();
  if (!fogTile) fogTile = makeFog();

  // ---- 1. upscale, nearest neighbour ----
  sctx.imageSmoothingEnabled = false;
  sctx.clearRect(0, 0, W, H);

  const shakeX = mood.shakeX || 0;
  const shakeY = mood.shakeY || 0;
  sctx.drawImage(sceneC, 0, 0, VW, VH, shakeX, shakeY, W, H);

  // ---- 2. bloom ----
  if (FX.bloom) {
    // bright pass: keep only what is already luminous
    bright.x.globalCompositeOperation = 'source-over';
    bright.x.clearRect(0, 0, BW, BH);
    bright.x.imageSmoothingEnabled = true;
    bright.x.drawImage(sceneC, 0, 0, BW, BH);

    // crush the darks so only highlights survive
    bright.x.globalCompositeOperation = 'multiply';
    const th = Math.round(FX.bloomThreshold * 255);
    bright.x.fillStyle = `rgb(${th},${th},${th})`;
    bright.x.fillRect(0, 0, BW, BH);
    bright.x.globalCompositeOperation = 'source-over';

    // blur by shrinking then growing: bilinear filtering does the work
    half.x.clearRect(0, 0, half.c.width, half.c.height);
    half.x.imageSmoothingEnabled = true;
    half.x.drawImage(bright.c, 0, 0, half.c.width, half.c.height);

    quarter.x.clearRect(0, 0, quarter.c.width, quarter.c.height);
    quarter.x.imageSmoothingEnabled = true;
    quarter.x.drawImage(half.c, 0, 0, quarter.c.width, quarter.c.height);

    sctx.imageSmoothingEnabled = true;
    sctx.globalCompositeOperation = 'lighter';
    sctx.globalAlpha = FX.bloomStrength * 0.75;
    sctx.drawImage(half.c, shakeX, shakeY, W, H);      // tight core
    sctx.globalAlpha = FX.bloomStrength * 0.6;
    sctx.drawImage(quarter.c, shakeX, shakeY, W, H);   // wide halo
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
  }

  // ---- 3. fog ----
  const fogAmt = (mood.fog ?? 1) * FX.fogStrength;
  if (FX.fog && fogAmt > 0.01) {
    // composite both drifting layers into one small buffer, then upscale once
    fogBuf.x.globalCompositeOperation = 'source-over';
    fogBuf.x.clearRect(0, 0, BW, BH);
    fogBuf.x.globalCompositeOperation = 'lighter';
    const layers = [
      { sp: 9, sc: 0.85, a: 0.42 },
      { sp: -5, sc: 1.35, a: 0.3 },
    ];
    for (const L of layers) {
      const tw = fogTile.width * L.sc;
      const off = ((t * L.sp) % tw + tw) % tw;
      fogBuf.x.globalAlpha = L.a;
      for (let x = -tw + off; x < BW; x += tw) {
        for (let y = -tw; y < BH; y += tw) fogBuf.x.drawImage(fogTile, x, y, tw, tw);
      }
    }
    fogBuf.x.globalAlpha = 1;

    sctx.imageSmoothingEnabled = true;
    sctx.globalCompositeOperation = 'screen';
    sctx.globalAlpha = fogAmt;
    sctx.drawImage(fogBuf.c, 0, 0, W, H);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
  }

  // ---- 4. colour tint (per-room mood) ----
  if (mood.tint) {
    sctx.globalCompositeOperation = 'multiply';
    sctx.fillStyle = mood.tint;
    sctx.fillRect(0, 0, W, H);
    sctx.globalCompositeOperation = 'source-over';
  }

  // ---- 5. vignette ----
  if (FX.vignette) {
    const strength = mood.vignette ?? 1;
    const g = sctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.28,
      W / 2, H / 2, Math.max(W, H) * 0.76
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, `rgba(4,3,10,${0.30 * strength})`);
    g.addColorStop(1, `rgba(2,1,6,${0.93 * strength})`);
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, W, H);
  }

  // ---- 6. chromatic aberration at the edges ----
  if (FX.aberration && (mood.aberration ?? 0) > 0.01) {
    const amt = mood.aberration * 3;
    sctx.globalCompositeOperation = 'lighter';
    sctx.globalAlpha = 0.16 * mood.aberration;
    sctx.drawImage(sceneC, 0, 0, VW, VH, shakeX - amt, shakeY, W, H);
    sctx.drawImage(sceneC, 0, 0, VW, VH, shakeX + amt, shakeY, W, H);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
  }

  // ---- 7. film grain ----
  if (FX.grain) {
    sctx.globalCompositeOperation = 'overlay';
    sctx.globalAlpha = 0.045;
    const gs = grainTile.width;
    const ox = -((t * 300) % gs);
    const oy = -((t * 220) % gs);
    for (let x = ox; x < W; x += gs) {
      for (let y = oy; y < H; y += gs) sctx.drawImage(grainTile, x, y);
    }
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
  }
}

/* ------------------------------------------------------------
   Light helpers — drawn into the low-res light buffer
   ------------------------------------------------------------ */

/**
 * Reset the light buffer to a room's ambient level.
 *
 * The buffer is a light *map*, not a glow layer: it is multiplied over the
 * scene, so this base colour is literally how bright an unlit floor tile ends
 * up. Keeping it low is what makes torchlight feel like the only light source
 * instead of a decal on an already-lit room.
 */
export function clearLights(ctx, ambient = '#2a2438') {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, VW, VH);
}

export function addLight(ctx, x, y, radius, color, intensity = 1) {
  if (radius <= 0 || intensity <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color.replace('ALPHA', (0.85 * intensity).toFixed(3)));
  g.addColorStop(0.45, color.replace('ALPHA', (0.34 * intensity).toFixed(3)));
  g.addColorStop(1, color.replace('ALPHA', '0'));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}
