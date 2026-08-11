// Boss weaponry: homing fireballs that curve toward the player, and the mouth
// laser with its telegraph.

import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';
import { rayHitsWall } from '../world/collision.js';

/* ============================================================
   Fireball — steers toward the player instead of flying straight.
   ============================================================ */

export class Fireball {
  constructor(x, y, angle, opts = {}) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = opts.speed ?? 96;
    this.turn = opts.turn ?? 2.3;      // radians/sec of steering authority
    this.damage = opts.damage ?? 3;
    this.life = opts.life ?? 4.2;
    this.radius = 4;
    this.dead = false;
    this.t = 0;
    this.trailT = 0;
    // homing fades out so the fireball can be dodged at the last moment
    this.homeFor = opts.homeFor ?? 1.5;
  }

  update(dt, player, map) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) { this.pop(); return; }

    if (this.t < this.homeFor) {
      const want = Math.atan2(player.y - this.y, player.x - this.x);
      let da = want - this.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const k = 1 - this.t / this.homeFor;
      this.angle += Math.max(-this.turn * dt, Math.min(this.turn * dt, da)) * k;
    }

    this.speed += 34 * dt;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    this.trailT += dt;
    if (this.trailT > 0.016) {
      this.trailT = 0;
      P.spawn({
        x: this.x + (Math.random() - 0.5) * 3,
        y: this.y + (Math.random() - 0.5) * 3,
        vx: -Math.cos(this.angle) * 22 + (Math.random() - 0.5) * 18,
        vy: -Math.sin(this.angle) * 22 + (Math.random() - 0.5) * 18,
        life: 0.3 + Math.random() * 0.25,
        size: 2,
        colour: Math.random() > 0.5 ? '#ffb648' : '#e87a2c',
        drag: 0.9,
        glow: 10,
        glowColour: 'rgba(255,150,50,ALPHA)',
      });
    }

    if (map.solidPx(this.x, this.y)) { this.pop(); return; }

    if (Math.hypot(player.x - this.x, player.y - this.y) < this.radius + 5) {
      player.hurt(this.damage, this.x, this.y);
      this.pop();
    }
  }

  pop() {
    if (this.dead) return;
    this.dead = true;
    sfx.fire();
    P.burst(this.x, this.y, 16, {
      colour: '#ffb648', speed: 90, life: 0.4, size: 2, drag: 0.88,
      glow: 14, glowColour: 'rgba(255,160,60,ALPHA)',
    });
    P.burst(this.x, this.y, 6, { colour: '#5c1a10', speed: 40, life: 0.7, size: 3, drag: 0.9 });
  }

  draw(ctx) {
    const f = 1 + Math.sin(this.t * 30) * 0.16;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // layered core: dark red -> orange -> white centre
    ctx.fillStyle = '#8f2f16';
    ctx.beginPath(); ctx.arc(this.x, this.y, 5 * f, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e87a2c';
    ctx.beginPath(); ctx.arc(this.x, this.y, 3.4 * f, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffeaa8';
    ctx.beginPath(); ctx.arc(this.x, this.y, 1.7 * f, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawLight(ctx) {
    addLight(ctx, this.x, this.y, 48, 'rgba(255,150,50,ALPHA)', 0.9);
  }
}

/* ============================================================
   Laser — telegraph, then a wide beam that sweeps nothing but hurts a lot.
   ============================================================ */

const TELEGRAPH = 0.55;
const FIRE = 0.5;
const FADE = 0.25;

export class Laser {
  constructor(owner, angle, opts = {}) {
    this.owner = owner;
    this.angle = angle;
    this.damage = opts.damage ?? 4;
    this.t = 0;
    this.dead = false;
    this.hitPlayer = false;
    this.len = opts.len ?? 520;
    this.roared = false;
  }

  get phase() {
    if (this.t < TELEGRAPH) return 'aim';
    if (this.t < TELEGRAPH + FIRE) return 'fire';
    return 'fade';
  }

  origin() {
    const o = this.owner;
    return { x: o.mouthX ? o.mouthX() : o.x, y: o.mouthY ? o.mouthY() : o.y };
  }

  update(dt, player, map) {
    this.t += dt;
    if (this.t > TELEGRAPH + FIRE + FADE) { this.dead = true; return; }

    const p = this.phase;
    const o = this.origin();

    if (p === 'aim') {
      // track slightly during the telegraph so it isn't trivially dodged
      const want = Math.atan2(player.y - o.y, player.x - o.x);
      let da = want - this.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.angle += Math.max(-1.1 * dt, Math.min(1.1 * dt, da));

      if (!this.roared) { this.roared = true; sfx.charge(); }

      // charge motes converging on the mouth
      if (Math.random() > 0.4) {
        const a = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 16;
        P.spawn({
          x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r,
          vx: -Math.cos(a) * 46, vy: -Math.sin(a) * 46,
          life: 0.34, size: 2, colour: '#ffeaa8', drag: 0.96,
          glow: 8, glowColour: 'rgba(255,200,90,ALPHA)',
        });
      }
    }

    if (p === 'fire') {
      if (this.t - dt < TELEGRAPH) {
        sfx.laser();
        cam.shake(5, FIRE);
        P.burst(o.x, o.y, 18, {
          colour: '#ffeaa8', speed: 130, life: 0.4, size: 2,
          angle: this.angle, spread: 0.9, glow: 14, glowColour: 'rgba(255,190,80,ALPHA)',
        });
      }

      // beam damage: distance from the player to the beam segment
      if (!this.hitPlayer) {
        const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
        const px = player.x - o.x, py = player.y - o.y;
        const proj = px * dx + py * dy;
        if (proj > 0 && proj < this.len) {
          const perp = Math.abs(px * -dy + py * dx);
          if (perp < 7 && !rayHitsWall(map, o.x, o.y, player.x, player.y)) {
            player.hurt(this.damage, o.x, o.y);
            this.hitPlayer = true;
          }
        }
      }

      // sparks along the beam
      if (Math.random() > 0.5) {
        const d = Math.random() * this.len;
        P.spawn({
          x: o.x + Math.cos(this.angle) * d,
          y: o.y + Math.sin(this.angle) * d,
          vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90,
          life: 0.28, size: 2, colour: '#ffeaa8', drag: 0.9,
          glow: 8, glowColour: 'rgba(255,200,100,ALPHA)',
        });
      }
    }
  }

  /** Beam length, cut short at the first wall. */
  reach(map) {
    const o = this.origin();
    const step = 4;
    for (let d = 0; d < this.len; d += step) {
      if (map.solidPx(o.x + Math.cos(this.angle) * d, o.y + Math.sin(this.angle) * d)) return d;
    }
    return this.len;
  }

  draw(ctx, map) {
    const o = this.origin();
    const p = this.phase;
    const len = this.reach(map);
    const ex = o.x + Math.cos(this.angle) * len;
    const ey = o.y + Math.sin(this.angle) * len;

    ctx.save();
    if (p === 'aim') {
      // thin warning line, brightening as it locks on
      const k = this.t / TELEGRAPH;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + k * 0.5;
      ctx.strokeStyle = '#cc3340';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -this.t * 30;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const k = p === 'fire' ? 1 : 1 - (this.t - TELEGRAPH - FIRE) / FADE;
      const flick = 0.86 + Math.random() * 0.14;
      ctx.globalCompositeOperation = 'lighter';

      ctx.globalAlpha = 0.4 * k;
      ctx.strokeStyle = '#8f2f16';
      ctx.lineWidth = 15 * k * flick;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ex, ey); ctx.stroke();

      ctx.globalAlpha = 0.8 * k;
      ctx.strokeStyle = '#e87a2c';
      ctx.lineWidth = 8 * k * flick;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ex, ey); ctx.stroke();

      ctx.globalAlpha = k;
      ctx.strokeStyle = '#ffeaa8';
      ctx.lineWidth = 3 * k * flick;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.restore();
  }

  drawLight(ctx, map) {
    const o = this.origin();
    if (this.phase === 'aim') {
      addLight(ctx, o.x, o.y, 30 * (this.t / TELEGRAPH), 'rgba(255,120,40,ALPHA)', this.t / TELEGRAPH);
      return;
    }
    const k = this.phase === 'fire' ? 1 : 1 - (this.t - TELEGRAPH - FIRE) / FADE;
    const len = this.reach(map);
    for (let d = 0; d < len; d += 28) {
      addLight(ctx, o.x + Math.cos(this.angle) * d, o.y + Math.sin(this.angle) * d,
        44, 'rgba(255,160,60,ALPHA)', 0.55 * k);
    }
  }
}
