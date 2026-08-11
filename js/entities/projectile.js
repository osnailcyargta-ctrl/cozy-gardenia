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

    // Fireballs can be batted out of the air. Integrity is a pool rather than a
    // swing counter so mixing weapons on one fireball still behaves sensibly:
    // the sword chips 5 (2 swings), bare hands chip 2 (5 swings).
    this.breakable = true;
    this.maxIntegrity = 10;
    this.integrity = 10;
    this.chipFlash = 0;
    this.knockT = 0;        // >0 while it is flying away from a swing
  }

  /** Take a swing. Returns true if this swing destroyed the fireball. */
  strike(weapon, fromX, fromY) {
    if (this.dead) return false;
    const chip = weapon?.projectileChip ?? 2;
    this.integrity -= chip;
    this.chipFlash = 0.18;

    if (this.integrity <= 0) {
      sfx.hit();
      cam.shake(3, 0.16);
      P.burst(this.x, this.y, 20, {
        colour: '#ffeaa8', speed: 120, life: 0.45, size: 2, drag: 0.88,
        glow: 14, glowColour: 'rgba(255,200,110,ALPHA)',
      });
      this.pop();
      return true;
    }

    // Survived — so stagger it in place.
    //
    // Without this the feature is impossible: a fireball is only inside sword
    // reach for 50-160ms while the swing cooldown is 360ms, so a second hit on
    // the same one can never land. Knocking it far away doesn't work either —
    // it can't turn around fast enough to come back. Stalling it just outside
    // the player is what actually buys the follow-up swing, and it reads as
    // the fireball reeling from the blow.
    // Heading is deliberately left alone. Flipping it to face away looks right
    // for one frame and then breaks everything: at 2.3 rad/s the fireball needs
    // ~1.4s to turn back around, so it just wanders off and the rally dies. It
    // stalls in place instead, and the recoil is sold by the flash and sparks.
    const away = Math.atan2(this.y - fromY, this.x - fromX);
    this.speed = 8;              // stalls where you hit it
    this.knockT = 0.5;           // longer than either weapon's cooldown
    this.t = 0;                  // restart the homing ramp from scratch

    sfx.hitWood();
    cam.shake(2, 0.1);
    P.burst(this.x, this.y, 10, {
      colour: '#ffb648', speed: 90, life: 0.32, size: 2, drag: 0.9,
      angle: away, spread: 1.6,
      glow: 8, glowColour: 'rgba(255,170,60,ALPHA)',
    });
    return false;
  }

  update(dt, player, map) {
    this.t += dt;
    this.chipFlash = Math.max(0, this.chipFlash - dt);
    if (this.knockT <= 0) this.life -= dt;   // staggered time is not on the clock
    if (this.life <= 0) { this.pop(); return; }

    if (this.knockT > 0) {
      this.knockT -= dt;          // staggered: drifting, not homing
    } else if (this.t < this.homeFor) {
      const want = Math.atan2(player.y - this.y, player.x - this.x);
      let da = want - this.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const k = 1 - this.t / this.homeFor;
      this.angle += Math.max(-this.turn * dt, Math.min(this.turn * dt, da)) * k;
    }

    if (this.knockT <= 0) this.speed += 34 * dt;
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

    // A staggered fireball cannot burn you. Without this it drifts into the
    // player mid-rally and pops on contact, which silently ends the exchange
    // before the follow-up swings can land — the exact reason bare hands could
    // never finish one off.
    if (this.knockT <= 0 &&
        Math.hypot(player.x - this.x, player.y - this.y) < this.radius + 5) {
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
    // Shrinks as it is chipped, and stutters harder the closer it is to
    // breaking — the player needs to see that the first swing landed.
    const wear = this.integrity / this.maxIntegrity;
    const size = 0.55 + wear * 0.45;
    const jitter = this.chipFlash > 0 ? (Math.random() - 0.5) * 2 : 0;
    const f = (1 + Math.sin(this.t * 30) * 0.16) * size;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const x = this.x + jitter, y = this.y + jitter;
    // layered core: dark red -> orange -> white centre
    ctx.fillStyle = '#8f2f16';
    ctx.beginPath(); ctx.arc(x, y, 5 * f, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e87a2c';
    ctx.beginPath(); ctx.arc(x, y, 3.4 * f, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.chipFlash > 0 ? '#ffffff' : '#ffeaa8';
    ctx.beginPath(); ctx.arc(x, y, 1.7 * f, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawLight(ctx) {
    const wear = this.integrity / this.maxIntegrity;
    addLight(ctx, this.x, this.y, 48 * (0.6 + wear * 0.4), 'rgba(255,150,50,ALPHA)', 0.9 * (0.55 + wear * 0.45));
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
    // Not breakable: this is a continuous beam whose origin is the boss's
    // mouth, not a discrete object flying through the air.
    this.breakable = false;
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
