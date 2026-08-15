// The thrown half of the Digital Claw Cannon.
//
// Right click on empty floor and the player's own hand goes, on a cable, until
// it hits something — anything: an enemy, a prop, a wall — and then it comes
// back. There is only ever one in the air, because you only have the one hand
// to throw.
//
// It is not a Fireball subclass. A fireball dies the instant it touches a wall
// and never returns; this has two halves and the second one chases a player who
// has moved since they threw it.

import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';

const RETURN_SPEED = 340;

export class Claw {
  constructor(x, y, angle, weapon, player) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.player = player;
    this.damage = weapon.throwDamage ?? 18;
    this.speed = weapon.throwSpeed ?? 240;
    this.radius = 5;
    this.returning = false;
    this.dead = false;
    this.t = 0;
    this.spin = 0;
    // the cable trails behind it, so the hand always reads as still attached
    this.hitSomething = false;
    sfx.swing();
  }

  /** Turn around, wherever it is. */
  recall(fx, fy) {
    if (this.returning) return;
    this.returning = true;
    cam.shake(2, 0.12);
    P.burst(fx ?? this.x, fy ?? this.y, 9, {
      colour: '#5cff7a', speed: 90, life: 0.28, size: 2, drag: 0.9,
      glow: 9, glowColour: 'rgba(92,255,122,ALPHA)',
    });
  }

  update(dt, enemies, map, solids) {
    this.t += dt;
    this.spin += dt * 18;

    if (!this.returning) {
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;

      // an enemy stops it, and takes the hit
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) < this.radius + (e.radius || 8)) {
          e.hurt(this.damage, this.x, this.y);
          this.hitSomething = true;
          this.recall(e.x, e.y);
          break;
        }
      }

      // so does a wall, or anything solid standing in the room
      if (!this.returning) {
        if (map.solidPx(this.x, this.y)) { this.recall(); }
        else {
          for (const s of solids) {
            if (!s.solid || s.dead || s === this.player) continue;
            if (Math.abs(this.x - s.x) < s.hw + 3 && Math.abs(this.y - s.y) < s.hh + 3) {
              this.recall();
              break;
            }
          }
        }
      }

      // and so does the edge of the room, so an unobstructed throw still comes back
      if (!this.returning && (this.x < 4 || this.y < 4 || this.x > 476 || this.y > 252)) this.recall();
      return;
    }

    // coming home — to wherever the player is now, not where they threw from
    const p = this.player;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(a) * RETURN_SPEED * dt;
    this.y += Math.sin(a) * RETURN_SPEED * dt;
    if (Math.hypot(p.x - this.x, p.y - this.y) < 10) {
      this.dead = true;
      sfx.pickup();
    }
  }

  draw(ctx) {
    const p = this.player;

    // the cable
    ctx.save();
    ctx.strokeStyle = 'rgba(38,194,71,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(p.x), Math.round(p.y));
    // a slack sag, so it reads as a cable rather than a laser sight
    const mx = (p.x + this.x) / 2, my = (p.y + this.y) / 2 + 5;
    ctx.quadraticCurveTo(mx, my, Math.round(this.x), Math.round(this.y));
    ctx.stroke();
    ctx.restore();

    // the hand: three claw fingers around a bright core
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(this.returning ? -this.spin : this.spin);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.strokeStyle = '#26c247';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
      ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.stroke();
    }
    ctx.fillStyle = '#c8ffd4';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }

  drawLight(ctx) {
    addLight(ctx, this.x, this.y, 30, 'rgba(38,194,71,ALPHA)', 0.5);
  }
}
