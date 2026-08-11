// One pooled particle system for embers, sparks, dust, blood, smoke and the
// boss's arcane motes. Particles can emit light, which is what ties them into
// the bloom pass.

import { addLight } from './postfx.js';

const MAX = 700;
const pool = [];
for (let i = 0; i < MAX; i++) {
  pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, colour: '#fff', fade: 1, grav: 0, drag: 1, glow: 0, glowColour: null, shrink: 1 });
}
let cursor = 0;

function take() {
  for (let i = 0; i < MAX; i++) {
    const p = pool[(cursor + i) % MAX];
    if (!p.alive) { cursor = (cursor + i + 1) % MAX; return p; }
  }
  return pool[cursor = (cursor + 1) % MAX]; // recycle oldest
}

export function spawn(opts) {
  const p = take();
  p.alive = true;
  p.x = opts.x; p.y = opts.y;
  p.vx = opts.vx || 0; p.vy = opts.vy || 0;
  p.max = p.life = opts.life || 0.5;
  p.size = opts.size || 1;
  p.colour = opts.colour || '#fff';
  p.grav = opts.grav || 0;
  p.drag = opts.drag ?? 0.94;
  p.glow = opts.glow || 0;
  p.glowColour = opts.glowColour || null;
  p.shrink = opts.shrink ?? 1;
  return p;
}

/** Radial burst helper. */
export function burst(x, y, n, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = opts.angle !== undefined
      ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? Math.PI * 2)
      : Math.random() * Math.PI * 2;
    const sp = (opts.speed ?? 40) * (0.45 + Math.random() * 0.8);
    spawn({
      ...opts,
      x: x + (Math.random() - 0.5) * (opts.jitter || 0),
      y: y + (Math.random() - 0.5) * (opts.jitter || 0),
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: (opts.life ?? 0.5) * (0.6 + Math.random() * 0.7),
      size: (opts.size ?? 1) * (0.7 + Math.random() * 0.7),
    });
  }
}

export function update(dt) {
  for (const p of pool) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    p.vy += p.grav * dt;
    const d = Math.pow(p.drag, dt * 60);
    p.vx *= d; p.vy *= d;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function draw(ctx) {
  for (const p of pool) {
    if (!p.alive) continue;
    const k = p.life / p.max;
    const s = Math.max(1, Math.round(p.size * (p.shrink === 1 ? 1 : (1 - (1 - k) * (1 - p.shrink)))));
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.fillStyle = p.colour;
    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
  }
  ctx.globalAlpha = 1;
}

export function drawLights(ctx) {
  for (const p of pool) {
    if (!p.alive || !p.glow) continue;
    const k = p.life / p.max;
    addLight(ctx, p.x, p.y, p.glow * (0.4 + k * 0.6), p.glowColour || 'rgba(255,170,60,ALPHA)', k);
  }
}

export function clear() {
  for (const p of pool) p.alive = false;
}

export function count() {
  let n = 0;
  for (const p of pool) if (p.alive) n++;
  return n;
}
