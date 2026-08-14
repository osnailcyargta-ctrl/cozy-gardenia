// Blackholian's Nest and what it spits.
//
// The nest is a one-shot block: place it and the item is spent. While it sits
// there it throws one black hole every five seconds; each hole drifts toward
// the nearest enemy, drags everything nearby into itself, and collapses after
// three seconds.
//
// The hole is the one thing in this game that takes light away. Lighting here
// is a light map that gets *multiplied* over the scene, so painting black into
// that buffer genuinely darkens the floor around it — an additive glow layer
// could never do this, it can only ever add.

import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';

export const NEST_INTERVAL = 5;
export const HOLE_LIFE = 3;

const HOLE_RADIUS = 62;
const HOLE_SPEED = 34;
const HOLE_TICK = 0.35;
const HOLE_DAMAGE = 7;

/* ============================================================
   The hole
   ============================================================ */

export class BlackHole {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.t = 0;
    this.life = HOLE_LIFE;
    this.dead = false;
    this.angle = Math.random() * Math.PI * 2;
    this.tick = 0;
    sfx.vanish();
  }

  /** 0 while it opens, 1 at full strength, back toward 0 as it collapses. */
  get strength() {
    const k = this.t / this.life;
    if (k < 0.15) return k / 0.15;
    if (k > 0.8) return (1 - k) / 0.2;
    return 1;
  }

  update(dt, enemies) {
    this.t += dt;
    if (this.t >= this.life) {
      this.dead = true;
      cam.shake(3, 0.2);
      P.burst(this.x, this.y, 20, {
        colour: '#ddb4ff', speed: 130, life: 0.4, size: 2, drag: 0.88,
        glow: 14, glowColour: 'rgba(168,102,224,ALPHA)',
      });
      return;
    }

    const s = this.strength;

    // drift toward whoever is nearest, slowly enough to be walked away from
    let best = null, bestD = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) {
      const a = Math.atan2(best.y - this.y, best.x - this.x);
      this.x += Math.cos(a) * HOLE_SPEED * s * dt;
      this.y += Math.sin(a) * HOLE_SPEED * s * dt;
    }

    this.tick -= dt;
    const bite = this.tick <= 0;
    if (bite) this.tick = HOLE_TICK;

    for (const e of enemies) {
      if (e.dead) continue;
      const dx = this.x - e.x, dy = this.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > HOLE_RADIUS) continue;

      // hauled in, harder the closer it already is
      const pull = (1 - d / HOLE_RADIUS) * 190 * s;
      e.knockX = (e.knockX || 0) + (dx / d) * pull * dt * 8;
      e.knockY = (e.knockY || 0) + (dy / d) * pull * dt * 8;

      // no knockback on the damage itself, or it would fight its own pull
      if (bite) e.hurt(Math.round(HOLE_DAMAGE * s), this.x, this.y, 0);
    }

    // matter falling in
    if (Math.random() > 0.25) {
      const a = Math.random() * Math.PI * 2;
      const r = HOLE_RADIUS * (0.55 + Math.random() * 0.45);
      P.spawn({
        x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
        vx: -Math.cos(a) * 150 - Math.sin(a) * 90,
        vy: -Math.sin(a) * 150 + Math.cos(a) * 90,
        life: 0.45, size: 2, colour: Math.random() > 0.5 ? '#a866e0' : '#ddb4ff',
        drag: 0.94, glow: 8, glowColour: 'rgba(168,102,224,ALPHA)',
      });
    }
  }

  draw(ctx) {
    const s = this.strength;
    const r = 13 * s;
    this.angle += 0.06;

    ctx.save();

    // the void itself — flat black, no blending, so it reads as a hole in the
    // room rather than a dark sprite laid on top of it
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';

    // accretion ring, squashed and spinning
    for (let i = 0; i < 3; i++) {
      const rr = r + 2.5 + i * 2.2;
      ctx.strokeStyle = `rgba(${[168, 200, 221][i]},${[102, 140, 180][i]},${[224, 240, 255][i]},${(0.55 - i * 0.15) * s})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, rr, rr * 0.42, this.angle + i * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // a hot rim right at the edge
    ctx.strokeStyle = `rgba(240,215,255,${0.85 * s})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r + 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawLight(ctx) {
    const s = this.strength;
    // Eat the light. `destination-out` punches a hole in the light map, and
    // because that map is multiplied over the scene the floor here goes dark.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, HOLE_RADIUS * 0.75);
    g.addColorStop(0, `rgba(0,0,0,${0.95 * s})`);
    g.addColorStop(0.45, `rgba(0,0,0,${0.5 * s})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, HOLE_RADIUS * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ...but the rim still glows
    addLight(ctx, this.x, this.y, 26, 'rgba(190,130,255,ALPHA)', 0.55 * s);
  }
}

/* ============================================================
   The nest
   ============================================================ */

export class Nest {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.t = 0;
    this.timer = NEST_INTERVAL;
    this.dead = false;
    this.pulse = 1;
    sfx.uiBig();
    P.burst(x, y, 16, {
      colour: '#a866e0', speed: 90, life: 0.5, size: 2, drag: 0.9,
      glow: 12, glowColour: 'rgba(168,102,224,ALPHA)',
    });
  }

  /** Returns a new BlackHole on the tick it spawns one, else null. */
  update(dt) {
    this.t += dt;
    this.pulse = Math.max(0, this.pulse - dt * 2);
    this.timer -= dt;
    if (this.timer > 0) return null;
    this.timer = NEST_INTERVAL;
    this.pulse = 1;
    return new BlackHole(this.x, this.y - 2);
  }

  /** How close the next hole is, 0..1 — drawn as a ring so the wait is legible. */
  get charge() { return 1 - this.timer / NEST_INTERVAL; }
}
