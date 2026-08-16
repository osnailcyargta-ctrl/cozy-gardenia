// Nullbyte — book three's monster.
//
// It chases and swipes like anything else, but one step in its loop is the
// corruption dash: it locks onto where you are standing, turns to static, and
// throws itself at that point. While that is happening nothing can hurt it.
//
// A hit does not take health. It takes the top off your health bar — half a
// heart of MAX hp, for as long as you stay in this book. That is why the
// invulnerable phase has to be so loud: an enemy that refuses damage without
// telling you why reads as a bug, and this one refuses damage in the same breath
// as it does something permanent to you.

import { decodeSet, draw, silhouette } from '../engine/sprite.js';
import { NULLBYTE } from '../data/sprites.js';
import { moveAgainst } from '../world/collision.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';

const A = decodeSet(NULLBYTE, 'nullbyte');

const CHASE = 'chase', SWIPE = 'swipe', LOCK = 'lock', DASH = 'dash', REST = 'rest';

/** Wind-up before the corruption dash. Long, because it cannot be answered. */
const LOCK_T = 0.6;
const DASH_T = 0.42;
const DASH_SPEED = 320;

/** Half a heart of max health per hit, and where it stops. */
export const CORRUPT_BITE = 5;
export const CORRUPT_FLOOR = 75;

export class Nullbyte {
  constructor(x, y, statMul = 1) {
    this.x = x; this.y = y;
    this.hw = 5; this.hh = 6;
    this.radius = 7;
    this.maxHp = Math.round(40 * statMul);
    this.hp = this.maxHp;
    this.damage = Math.round(8 * statMul);
    this.armour = 0;
    this.solid = false;
    this.dead = false;
    this.deathT = 0;
    this.vx = 0; this.vy = 0;
    this.flip = false;
    this.anim = Math.random() * 4;
    this.hurtFlash = 0;
    this.knockX = 0; this.knockY = 0;
    this.slowMul = 1; this.slowUntil = 0;
    this.keyId = null;

    this.state = CHASE;
    this.t = Math.random() * 0.5;
    this.hitThisAttack = false;
    this.dashAngle = 0;
    this.corruptedThisDash = false;
  }

  /** True from the moment it locks on until the dash is spent. */
  get invulnerable() { return this.state === LOCK || this.state === DASH; }

  hurt(amount, fromX, fromY, knockScale = 1) {
    if (this.dead) return 0;
    // Nothing lands while it is corrupting. The rim and the static say so.
    if (this.invulnerable) {
      P.burst(this.x, this.y, 4, {
        colour: '#c8ffd4', speed: 70, life: 0.22, size: 1, drag: 0.9,
      });
      sfx.denied();
      return 0;
    }

    const dealt = amount <= 0 ? 0 : Math.max(1, amount - this.armour);
    if (dealt <= 0) return 0;
    this.hp -= dealt;
    this.hurtFlash = 0.2;
    sfx.hit();

    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.knockX = Math.cos(a) * 140 * knockScale;
    this.knockY = Math.sin(a) * 140 * knockScale;

    P.burst(this.x, this.y, 7, {
      colour: '#26c247', speed: 85, life: 0.3, size: 2, grav: 120, drag: 0.9,
    });
    if (this.hp <= 0) this.die();
    return dealt;
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    sfx.vanish();
    cam.shake(2, 0.16);
    // it does not fall over, it decompiles
    for (let i = 0; i < 22; i++) {
      P.spawn({
        x: this.x + (Math.random() - 0.5) * 12,
        y: this.y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 40,
        vy: -20 - Math.random() * 60,
        life: 0.5 + Math.random() * 0.4, size: 1 + (Math.random() > 0.7 ? 1 : 0),
        colour: Math.random() > 0.5 ? '#26c247' : '#5cff7a',
        drag: 0.94, glow: 7, glowColour: 'rgba(38,194,71,ALPHA)',
      });
    }
  }

  update(dt, player, map, solids) {
    if (this.dead) { this.deathT += dt; return; }

    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.t += dt;
    if (this.slowUntil > 0) {
      this.slowUntil -= dt;
      if (this.slowUntil <= 0) this.slowMul = 1;
    }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (this.state !== DASH) this.flip = dx < 0;

    const SPEED = 44 * this.slowMul;
    let mx = 0, my = 0;

    switch (this.state) {
      case CHASE:
        mx = (dx / dist) * SPEED;
        my = (dy / dist) * SPEED;
        // every third approach is the corruption dash instead of a swipe
        if (this.t > 2.4 && dist < 150) { this.state = LOCK; this.t = 0; }
        else if (dist < 20) { this.state = SWIPE; this.t = 0; this.hitThisAttack = false; }
        break;

      case SWIPE:
        mx = (dx / dist) * SPEED * 0.4;
        my = (dy / dist) * SPEED * 0.4;
        if (this.t > 0.2 && !this.hitThisAttack) {
          this.hitThisAttack = true;
          if (dist < 24) player.hurt(Math.round(this.damage * (this.dmgMul ?? 1)), this.x, this.y);
        }
        if (this.t > 0.45) { this.state = REST; this.t = 0; }
        break;

      case LOCK:
        // Standing still, aiming. The lock is taken once, at the very start —
        // it is a committed line you can step out of, not a homing missile.
        if (this.t < dt * 2) {
          this.dashAngle = Math.atan2(dy, dx);
          sfx.charge();
        }
        if (Math.random() > 0.55) {
          P.spawn({
            x: this.x + (Math.random() - 0.5) * 18,
            y: this.y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
            life: 0.25, size: 1, colour: Math.random() > 0.5 ? '#ff3355' : '#c8ffd4',
            glow: 6, glowColour: 'rgba(255,51,85,ALPHA)',
          });
        }
        if (this.t > LOCK_T) {
          this.state = DASH; this.t = 0;
          this.corruptedThisDash = false;
          sfx.dash();
          cam.shake(4, 0.24);
        }
        break;

      case DASH: {
        const sp = DASH_SPEED * this.slowMul;
        mx = Math.cos(this.dashAngle) * sp;
        my = Math.sin(this.dashAngle) * sp;
        if (!this.corruptedThisDash && dist < 18) {
          this.corruptedThisDash = true;
          // The hit is the corruption. No health is taken — the bar gets shorter,
          // and it stays shorter until you leave the book.
          if (player.corrupt?.(CORRUPT_BITE, CORRUPT_FLOOR)) {
            sfx.death();
            cam.shake(7, 0.5);
            P.burst(player.x, player.y, 20, {
              colour: '#ff3355', speed: 120, life: 0.6, size: 2, drag: 0.9,
              glow: 12, glowColour: 'rgba(255,51,85,ALPHA)',
            });
          }
        }
        if (this.t > DASH_T) { this.state = REST; this.t = 0; }
        break;
      }

      case REST:
        if (this.t > 0.55) { this.state = CHASE; this.t = 0; }
        break;
    }

    const kd = Math.pow(0.002, dt);
    this.knockX *= kd; this.knockY *= kd;

    for (const o of solids) {
      if (o === this || o.dead || !(o instanceof Nullbyte)) continue;
      const ox = this.x - o.x, oy = this.y - o.y;
      const od = Math.hypot(ox, oy);
      if (od < 13 && od > 0.01) { mx += (ox / od) * 40; my += (oy / od) * 40; }
    }

    this.vx = mx; this.vy = my;
    moveAgainst(map, solids, this, (mx + this.knockX) * dt, (my + this.knockY) * dt);
    this.anim += dt * (this.state === CHASE ? 7 : 5);
  }

  sprite() {
    const f = Math.floor(this.anim);
    if (this.invulnerable) return A.corrupt[0];
    if (this.hurtFlash > 0.1) return A.hurt[0];
    if (this.state === CHASE) return A.run[f % 3];
    return A.idle[f % 2];
  }

  draw(ctx) {
    if (this.dead) {
      if (this.deathT > 0.3) return;
      const k = this.deathT / 0.3;
      draw(ctx, silhouette(this.sprite(), '#5cff7a'), this.x, this.y, {
        alpha: 1 - k, scale: 1 + k * 0.4, flip: this.flip,
      });
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 7), 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // While it is corrupting, the sprite tears sideways in bands — the same
    // trick a broken video signal uses, and the clearest possible "do not touch".
    if (this.invulnerable) {
      const spr = this.sprite();
      for (let band = 0; band < 4; band++) {
        const off = Math.round((Math.random() - 0.5) * 5);
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x - 12, this.y - 10 + band * 5, 24, 5);
        ctx.clip();
        draw(ctx, spr, this.x + off, this.y, { flip: this.flip });
        ctx.restore();
      }
      // the locked line, drawn while it aims
      if (this.state === LOCK) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,51,85,0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.lineDashOffset = -this.t * 30;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.dashAngle) * 190, this.y + Math.sin(this.dashAngle) * 190);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    draw(ctx, this.sprite(), this.x, this.y, { flip: this.flip });

    if (this.hurtFlash > 0) {
      draw(ctx, silhouette(this.sprite(), '#fff'), this.x, this.y, {
        alpha: this.hurtFlash * 3.6, flip: this.flip,
      });
    }

    if (this.hp < this.maxHp) {
      const w = 13;
      const x = Math.round(this.x - w / 2), y = Math.round(this.y - 12);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x - 1, y - 1, w + 2, 4);
      ctx.fillStyle = '#0a3d17';
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = '#26c247';
      ctx.fillRect(x, y, Math.max(0, Math.round(w * (this.hp / this.maxHp))), 2);
    }
  }

  drawLight(ctx) {
    if (this.dead) return;
    if (this.invulnerable) {
      addLight(ctx, this.x, this.y, 34, 'rgba(255,51,85,ALPHA)', 0.55);
      return;
    }
    addLight(ctx, this.x, this.y - 3, 22, 'rgba(38,194,71,ALPHA)', 0.36);
  }
}
