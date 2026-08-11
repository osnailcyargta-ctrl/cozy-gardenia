// Room gates. Two kinds:
//   'wood'   — 12 HP, immune to fists, so it gates progress behind the sword
//   'locked' — no amount of hitting helps; it wants the key the tier II servant drops

import { decode, draw, silhouette } from '../engine/sprite.js';
import { BLOCKS } from '../data/sprites.js';
import { TILE } from '../engine/canvas.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';

const S = {
  gate: decode(BLOCKS.gate[0], 'gate'),
  hurt: decode(BLOCKS.gateHurt[0], 'gateHurt'),
  locked: decode(BLOCKS.gateLocked[0], 'gateLocked'),
};

export class Gate {
  constructor({ tx, ty, kind, hp = 12 }) {
    this.tx = tx; this.ty = ty;
    this.kind = kind;
    this.maxHp = hp;
    this.hp = hp;
    this.open = false;
    this.dead = false;
    this.solid = true;

    // spans two tiles vertically — a doorway, not a brick
    this.x = tx * TILE + TILE / 2;
    this.y = ty * TILE + TILE;
    this.hw = TILE / 2;
    this.hh = TILE;

    this.shake = 0;
    this.flash = 0;
    this.openT = 0;
  }

  get isLocked() { return this.kind === 'locked' && !this.open; }

  /** Returns 'blocked' | 'damaged' | 'broken' */
  strike(damage, weapon, fromX, fromY) {
    if (this.open) return 'broken';

    if (this.kind === 'locked') {
      this.shake = 0.25;
      sfx.denied();
      P.burst(this.x, this.y, 5, { colour: '#7d92a6', speed: 40, life: 0.3, size: 2, grav: 120 });
      return 'blocked';
    }

    // bare hands cannot hurt wood (and deal 0 anyway)
    if (weapon?.isFist || damage <= 0) {
      this.shake = 0.18;
      sfx.hitWood();
      P.burst(this.x, this.y, 3, { colour: '#7a5a38', speed: 25, life: 0.25, size: 1 });
      return 'blocked';
    }

    this.hp -= damage;
    this.shake = 0.22;
    this.flash = 0.2;
    sfx.hitWood();
    cam.shake(3, 0.18);

    P.burst(this.x, this.y, 9, {
      colour: '#7a5a38', speed: 80, life: 0.5, size: 2, grav: 240, drag: 0.9,
      angle: Math.atan2(this.y - fromY, this.x - fromX), spread: 2.2,
    });

    if (this.hp <= 0) { this.breakOpen(); return 'broken'; }
    return 'damaged';
  }

  unlock() {
    if (this.open) return false;
    this.open = true;
    this.solid = false;
    this.openT = 0;
    sfx.unlock();
    P.burst(this.x, this.y, 18, {
      colour: '#f0cc5a', speed: 90, life: 0.7, size: 2, grav: 60, drag: 0.9,
      glow: 12, glowColour: 'rgba(240,204,90,ALPHA)',
    });
    return true;
  }

  breakOpen() {
    this.open = true;
    this.solid = false;
    this.openT = 0;
    this.hp = 0;
    sfx.break();
    cam.shake(7, 0.5);
    for (let i = 0; i < 34; i++) {
      P.spawn({
        x: this.x + (Math.random() - 0.5) * TILE,
        y: this.y + (Math.random() - 0.5) * TILE * 2,
        vx: (Math.random() - 0.5) * 190,
        vy: (Math.random() - 0.9) * 140,
        life: 0.7 + Math.random() * 0.6,
        size: 1 + Math.random() * 3,
        colour: ['#3a2a1c', '#573f28', '#7a5a38', '#a07a4c'][(Math.random() * 4) | 0],
        grav: 320, drag: 0.94,
      });
    }
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.open) this.openT += dt;
  }

  draw(ctx) {
    if (this.open && this.openT > 0.35) return;

    const sx = this.shake > 0 ? Math.sin(this.shake * 90) * this.shake * 12 : 0;
    const damaged = this.kind === 'wood' && this.hp <= this.maxHp * 0.5;
    const spr = this.kind === 'locked' ? S.locked : (damaged ? S.hurt : S.gate);

    const alpha = this.open ? 1 - this.openT / 0.35 : 1;

    // two stacked tiles fill the doorway
    for (let i = 0; i < 2; i++) {
      const y = this.ty * TILE + i * TILE + TILE / 2;
      draw(ctx, spr, this.x + sx, y, { alpha });
      if (this.flash > 0) {
        draw(ctx, silhouette(spr, '#ffdca8'), this.x + sx, y, { alpha: this.flash * 4 * alpha });
      }
    }

    // health pips while it is being chewed through
    if (this.kind === 'wood' && this.hp < this.maxHp && !this.open) {
      const w = 22;
      const x = Math.round(this.x - w / 2);
      const y = Math.round(this.ty * TILE - 7);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(x - 1, y - 1, w + 2, 4);
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = '#a07a4c';
      ctx.fillRect(x, y, Math.max(0, Math.round(w * (this.hp / this.maxHp))), 2);
    }
  }

  drawLight(ctx) {
    if (this.kind === 'locked' && !this.open) {
      addLight(ctx, this.x, this.y - 8, 22, 'rgba(240,204,90,ALPHA)', 0.34);
    }
    if (this.open && this.openT < 0.5) {
      addLight(ctx, this.x, this.y, 70, 'rgba(255,200,120,ALPHA)', 1 - this.openT / 0.5);
    }
  }
}
