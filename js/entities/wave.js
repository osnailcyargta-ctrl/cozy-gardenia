// The wave gun's payload: a cone of water that stays where it was fired.
//
// Unlike a swing, the cast is not the whole attack — it is the opening hit on a
// field that then sits in the room for a second and a half, chewing on anything
// that stays inside it and dragging it down to a crawl. That is the whole
// reason the weapon exists: it turns a corridor into ground the enemy has to
// pay to cross, instead of another way to poke something in front of you.

import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';

export class WaveField {
  constructor(x, y, angle, w) {
    // Anchored at the cast, not carried on the player: walking away must not
    // drag the wave along, or holding the button becomes a moving shield.
    this.x = x; this.y = y;
    this.angle = angle;
    this.range = w.range ?? 64;
    this.arc = w.arc ?? 0.9;
    this.life = w.duration ?? 1.5;
    this.maxLife = this.life;
    this.tickDamage = w.tick ?? 8;
    this.tickMin = w.tickMin ?? 0.2;
    this.tickMax = w.tickMax ?? 0.7;
    this.slow = w.slow ?? 0.45;
    this.dead = false;
    this.t = 0;

    // one countdown per enemy, so two enemies in the same wave are not locked
    // to the same rhythm
    this.timers = new Map();

    sfx.wave();
    for (let i = 0; i < 22; i++) {
      const a = angle + (Math.random() - 0.5) * this.arc;
      const d = Math.random() * this.range;
      P.spawn({
        x: x + Math.cos(a) * d * 0.3, y: y + Math.sin(a) * d * 0.3,
        vx: Math.cos(a) * (90 + Math.random() * 70),
        vy: Math.sin(a) * (90 + Math.random() * 70),
        life: 0.34 + Math.random() * 0.2, size: 2,
        colour: Math.random() > 0.5 ? '#70dad4' : '#c4f6ef',
        drag: 0.9, glow: 10, glowColour: 'rgba(110,220,215,ALPHA)',
      });
    }
  }

  /** Is this point inside the cone? */
  contains(px, py, radius = 0) {
    const dx = px - this.x, dy = py - this.y;
    const d = Math.hypot(dx, dy);
    if (d > this.range + radius) return false;
    if (d < 4) return true;
    let da = Math.atan2(dy, dx) - this.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    // widen the angular test for big targets, or a boss standing dead centre
    // slips out of a cone its own body fills
    const slack = radius > 0 ? Math.atan2(radius, Math.max(d, 1)) : 0;
    return Math.abs(da) <= this.arc / 2 + slack;
  }

  update(dt, enemies) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    for (const e of enemies) {
      if (e.dead) continue;
      if (!this.contains(e.x, e.y, e.radius || 8)) continue;

      e.slowUntil = Math.max(e.slowUntil || 0, 0.6);   // recovers after leaving
      e.slowMul = 1 - this.slow;

      let timer = this.timers.get(e);
      if (timer === undefined) {
        // First sight waits a full interval rather than firing instantly:
        // otherwise the cast's 9 and the field's 8 land on the same frame and
        // stepping into a wave for one frame costs 17.
        timer = this.tickMin + Math.random() * (this.tickMax - this.tickMin);
      }
      timer -= dt;
      if (timer <= 0) {
        e.hurt(this.tickDamage, this.x, this.y, 0);   // no shove: see hurt()
        timer = this.tickMin + Math.random() * (this.tickMax - this.tickMin);
        P.burst(e.x, e.y, 5, {
          colour: '#70dad4', speed: 60, life: 0.3, size: 2, drag: 0.9,
          glow: 10, glowColour: 'rgba(110,220,215,ALPHA)',
        });
      }
      this.timers.set(e, timer);
    }

    // froth rolling outward through the cone
    if (Math.random() > 0.35) {
      const a = this.angle + (Math.random() - 0.5) * this.arc;
      const d = 8 + Math.random() * (this.range - 8);
      P.spawn({
        x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d,
        vx: Math.cos(a) * 24, vy: Math.sin(a) * 24 - 10,
        life: 0.4, size: 2, colour: '#70dad4', drag: 0.92,
        glow: 8, glowColour: 'rgba(110,220,215,ALPHA)',
      });
    }
  }

  draw(ctx) {
    const k = this.life / this.maxLife;
    const a0 = this.angle - this.arc / 2;
    const a1 = this.angle + this.arc / 2;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // the body of the cone, fading as it expires
    const g = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, this.range);
    g.addColorStop(0, `rgba(120,230,225,${0.32 * k})`);
    g.addColorStop(0.55, `rgba(56,170,182,${0.2 * k})`);
    g.addColorStop(1, 'rgba(21,88,109,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.arc(this.x, this.y, this.range, a0, a1);
    ctx.closePath();
    ctx.fill();

    // ripples travelling out along the cone, so it reads as moving water
    ctx.strokeStyle = `rgba(196,246,239,${0.5 * k})`;
    for (let i = 0; i < 3; i++) {
      const phase = ((this.t * 1.9 + i / 3) % 1);
      const r = 6 + phase * (this.range - 6);
      ctx.globalAlpha = (1 - phase) * k;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, a0, a1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // crisp edges
    ctx.strokeStyle = `rgba(112,218,212,${0.45 * k})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + Math.cos(a0) * this.range, this.y + Math.sin(a0) * this.range);
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + Math.cos(a1) * this.range, this.y + Math.sin(a1) * this.range);
    ctx.stroke();
    ctx.restore();
  }

  drawLight(ctx) {
    const k = this.life / this.maxLife;
    for (let i = 1; i <= 4; i++) {
      const d = (i / 4) * this.range;
      addLight(ctx, this.x + Math.cos(this.angle) * d, this.y + Math.sin(this.angle) * d,
        30 + d * 0.4, 'rgba(90,210,210,ALPHA)', 0.5 * k);
    }
  }
}
