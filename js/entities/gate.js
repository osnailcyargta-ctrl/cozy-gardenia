// Room gates. Four kinds:
//   'wood'   — immune to fists, so it gates progress behind a real weapon
//   'coral'  — book two's equivalent: same rules, more health, different art
//   'locked' — no amount of hitting helps; it wants the key its book's elite drops
//   'error'  — book three's: also unhittable, and opens only when the sliding
//              board behind it is put back in order

import { decode, draw, silhouette } from '../engine/sprite.js';
import { BLOCKS } from '../data/sprites.js';
import { TILE } from '../engine/canvas.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';

const S = {
  wood:        { whole: decode(BLOCKS.gate[0], 'gate'),
                 hurt:  decode(BLOCKS.gateHurt[0], 'gateHurt') },
  coral:       { whole: decode(BLOCKS.coralGate[0], 'coralGate'),
                 hurt:  decode(BLOCKS.coralGateHurt[0], 'coralGateHurt') },
  locked:      decode(BLOCKS.gateLocked[0], 'gateLocked'),
  coralLocked: decode(BLOCKS.coralGateLocked[0], 'coralGateLocked'),
  cryptLocked: decode(BLOCKS.cryptGateLocked[0], 'cryptGateLocked'),
  errorGate:   decode(BLOCKS.errorGate[0], 'errorGate'),
};

// splinters for wood, shards for coral
const DEBRIS = {
  wood:  ['#3a2a1c', '#573f28', '#7a5a38', '#a07a4c'],
  coral: ['#3d1430', '#7a1f45', '#b83a5a', '#e8688a'],
};

/** Gates you cannot hit open, whatever you are holding. */
const SEALED = (kind) => kind === 'locked' || kind === 'error';

export class Gate {
  constructor({ tx, ty, kind, hp = 12, keyId = 'key', theme = 'wood', tier = 0 }) {
    this.tx = tx; this.ty = ty;
    this.kind = kind;
    this.keyId = keyId;
    // Which tier of board sits behind an errored gate — how many walls, and how
    // long the shortest route through them has to be.
    this.tier = tier;
    // a locked gate still needs to look like it belongs to its book
    this.theme = kind === 'locked' ? theme : kind;
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

    // An errored gate is the only gate you talk to rather than hit or unlock,
    // so it joins the props in the interaction sweep. Same fields they use.
    this.type = 'gate';
    this.interactive = kind === 'error';
    this.label = 'Defragment';
    this.reach = 26;
  }

  get isLocked() { return this.kind === 'locked' && !this.open; }

  /** Returns 'blocked' | 'damaged' | 'broken' */
  strike(damage, weapon, fromX, fromY) {
    if (this.open) return 'broken';

    // Neither of these can be hit open. A locked gate wants its key; an errored
    // one wants its blocks put back where they belong.
    if (SEALED(this.kind)) {
      this.shake = 0.25;
      sfx.denied();
      P.burst(this.x, this.y, 5,
        this.kind === 'error'
          ? { colour: '#ff3355', speed: 44, life: 0.3, size: 2, grav: 90 }
          : { colour: '#7d92a6', speed: 40, life: 0.3, size: 2, grav: 120 });
      return 'blocked';
    }

    const debris = DEBRIS[this.theme] || DEBRIS.wood;

    // bare hands cannot hurt it (and deal 0 anyway)
    if (weapon?.isFist || damage <= 0) {
      this.shake = 0.18;
      sfx.hitWood();
      P.burst(this.x, this.y, 3, { colour: debris[2], speed: 25, life: 0.25, size: 1 });
      return 'blocked';
    }

    this.hp -= damage;
    this.shake = 0.22;
    this.flash = 0.2;
    sfx.hitWood();
    cam.shake(3, 0.18);

    P.burst(this.x, this.y, 9, {
      colour: debris[2], speed: 80, life: 0.5, size: 2, grav: 240, drag: 0.9,
      angle: Math.atan2(this.y - fromY, this.x - fromX), spread: 2.2,
    });

    if (this.hp <= 0) { this.breakOpen(); return 'broken'; }
    return 'damaged';
  }

  unlock() {
    if (this.open) return false;
    this.open = true;
    this.solid = false;
    this.interactive = false;
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
    this.interactive = false;
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
        colour: (DEBRIS[this.theme] || DEBRIS.wood)[(Math.random() * 4) | 0],
        grav: 320, drag: 0.94,
      });
    }
  }

  /**
   * Open with no sound, no shake and no debris — for restoring a gate you
   * already broke on a previous visit. Replaying the break would announce a
   * victory you won an hour ago.
   */
  openSilently() {
    this.open = true;
    this.solid = false;
    this.interactive = false;
    this.hp = 0;
    this.openT = 1;
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.open) this.openT += dt;
  }

  draw(ctx) {
    if (this.open && this.openT > 0.35) return;

    const sx = this.shake > 0 ? Math.sin(this.shake * 90) * this.shake * 12 : 0;
    const breakable = !SEALED(this.kind);
    const damaged = breakable && this.hp <= this.maxHp * 0.5;
    const set = S[this.theme] || S.wood;
    const spr = this.kind === 'error' ? S.errorGate
      : this.kind === 'locked'
        ? ({ coral: S.coralLocked, crypt: S.cryptLocked }[this.theme] || S.locked)
        : (damaged ? set.hurt : set.whole);

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
    if (breakable && this.hp < this.maxHp && !this.open) {
      const w = 22;
      const x = Math.round(this.x - w / 2);
      const y = Math.round(this.ty * TILE - 7);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(x - 1, y - 1, w + 2, 4);
      ctx.fillStyle = (DEBRIS[this.theme] || DEBRIS.wood)[0];
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = (DEBRIS[this.theme] || DEBRIS.wood)[3];
      ctx.fillRect(x, y, Math.max(0, Math.round(w * (this.hp / this.maxHp))), 2);
    }
  }

  drawLight(ctx) {
    // An errored gate does not glow steadily, it flickers like a bad signal.
    if (this.kind === 'error' && !this.open) {
      const f = 0.5 + Math.sin(this.openT * 0 + performance.now() * 0.011) * 0.25
        + (Math.random() > 0.93 ? 0.4 : 0);
      addLight(ctx, this.x, this.y - 8, 26, 'rgba(38,194,71,ALPHA)', 0.3 * f);
      return;
    }
    if (this.kind === 'locked' && !this.open) {
      addLight(ctx, this.x, this.y - 8, 22, {
        coral: 'rgba(232,104,138,ALPHA)',
        crypt: 'rgba(168,102,224,ALPHA)',
      }[this.theme] || 'rgba(240,204,90,ALPHA)', 0.34);
    }
    if (this.open && this.openT < 0.5) {
      addLight(ctx, this.x, this.y, 70, 'rgba(255,200,120,ALPHA)', 1 - this.openT / 0.5);
    }
  }
}
