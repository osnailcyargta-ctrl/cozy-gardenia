// Zombie Crawler — book four's baseline monster.
//
// No pattern, no telegraphed special: it walks at you and bites. That is the
// point. The infinite dungeon gets its difficulty from how many of these there
// are and how hard they hit, so the individual has to be simple enough that
// twenty-five of them at once is still readable.

import { decodeSet, draw, silhouette } from '../engine/sprite.js';
import { CRAWLER } from '../data/sprites.js';
import { moveAgainst } from '../world/collision.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';

const A = decodeSet(CRAWLER, 'crawler');

const CHASE = 'chase', BITE = 'bite', REST = 'rest';

export class Crawler {
  constructor(x, y, statMul = 1, purse = null) {
    this.x = x; this.y = y;
    this.hw = 5; this.hh = 5;
    this.radius = 7;
    this.maxHp = Math.round(26 * statMul);
    this.hp = this.maxHp;
    this.damage = Math.round(7 * statMul);
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

    this.state = CHASE;
    this.t = Math.random() * 0.4;
    this.bitThisAttack = false;
    // The coin purse of the dungeon. Not every corpse is carrying. The dungeon
    // hands this down from the room's seed so a rebuilt room is the same room;
    // anywhere else, roll it here.
    this.dropsCoin = purse ? purse.dropsCoin : Math.random() < 0.6;
    this.coinCount = purse ? purse.coinCount : 1 + ((Math.random() * 3) | 0);
  }

  hurt(amount, fromX, fromY, knockScale = 1) {
    if (this.dead) return 0;
    const dealt = amount <= 0 ? 0 : Math.max(1, amount - this.armour);
    if (dealt <= 0) return 0;
    this.hp -= dealt;
    this.hurtFlash = 0.2;
    sfx.hit();

    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.knockX = Math.cos(a) * 150 * knockScale;
    this.knockY = Math.sin(a) * 150 * knockScale;

    P.burst(this.x, this.y, 7, {
      colour: '#2c5638', speed: 80, life: 0.32, size: 2, grav: 130, drag: 0.9,
    });
    if (this.hp <= 0) this.die();
    return dealt;
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    sfx.break();
    cam.shake(2, 0.16);
    P.burst(this.x, this.y, 18, {
      colour: '#2c5638', speed: 95, life: 0.6, size: 2, grav: 150, drag: 0.9,
    });
    P.burst(this.x, this.y, 8, { colour: '#d8cba8', speed: 60, life: 0.5, size: 2, grav: 220 });
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
    this.flip = dx < 0;

    const SPEED = 42 * this.slowMul;
    let mx = 0, my = 0;

    switch (this.state) {
      case CHASE:
        mx = (dx / dist) * SPEED;
        my = (dy / dist) * SPEED;
        if (dist < 18) { this.state = BITE; this.t = 0; this.bitThisAttack = false; }
        break;

      case BITE:
        // a short lurch forward rather than a standing bite, so a crowd of them
        // reads as pressure instead of a wall
        mx = (dx / dist) * SPEED * 1.6;
        my = (dy / dist) * SPEED * 1.6;
        if (this.t > 0.22 && !this.bitThisAttack) {
          this.bitThisAttack = true;
          if (dist < 20) player.hurt(this.damage, this.x, this.y);
          P.burst(this.x + (dx / dist) * 8, this.y + (dy / dist) * 8, 4, {
            colour: '#cc3340', speed: 55, life: 0.2, size: 2,
          });
        }
        if (this.t > 0.42) { this.state = REST; this.t = 0; }
        break;

      case REST:
        if (this.t > 0.5) { this.state = CHASE; this.t = 0; }
        break;
    }

    const kd = Math.pow(0.002, dt);
    this.knockX *= kd; this.knockY *= kd;

    // spread out, or twenty-five of them stack into one dot
    for (const o of solids) {
      if (o === this || o.dead || !(o instanceof Crawler)) continue;
      const ox = this.x - o.x, oy = this.y - o.y;
      const od = Math.hypot(ox, oy);
      if (od < 12 && od > 0.01) { mx += (ox / od) * 44; my += (oy / od) * 44; }
    }

    this.vx = mx; this.vy = my;
    moveAgainst(map, solids, this, (mx + this.knockX) * dt, (my + this.knockY) * dt);
    this.anim += dt * (this.state === CHASE ? 8 : 5);
  }

  sprite() {
    const f = Math.floor(this.anim);
    if (this.hurtFlash > 0.1) return A.hurt[0];
    if (this.state === BITE) return A.attack[0];
    if (this.state === CHASE) return A.run[f % 3];
    return A.idle[f % 2];
  }

  draw(ctx) {
    if (this.dead) {
      if (this.deathT > 0.35) return;
      const k = this.deathT / 0.35;
      draw(ctx, silhouette(this.sprite(), '#5c8f5a'), this.x, this.y, {
        alpha: 1 - k, scale: 1 + k * 0.3, flip: this.flip,
      });
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 6), 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    draw(ctx, this.sprite(), this.x, this.y, { flip: this.flip });

    if (this.hurtFlash > 0) {
      draw(ctx, silhouette(this.sprite(), '#fff'), this.x, this.y, {
        alpha: this.hurtFlash * 3.6, flip: this.flip,
      });
    }

    if (this.hp < this.maxHp) {
      const w = 12;
      const x = Math.round(this.x - w / 2), y = Math.round(this.y - 11);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x - 1, y - 1, w + 2, 4);
      ctx.fillStyle = '#12261c';
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = '#5c8f5a';
      ctx.fillRect(x, y, Math.max(0, Math.round(w * (this.hp / this.maxHp))), 2);
    }
  }

  drawLight(ctx) {
    if (this.dead) return;
    // only the eyes glow, and barely — a crowd of these should not light a room
    addLight(ctx, this.x, this.y - 3, 18, 'rgba(204,51,64,ALPHA)', 0.3);
  }
}
