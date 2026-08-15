// The Kernel — book three's boss.
//
// It does not walk. It sits in the middle of the room and turns, and everything
// it does is geometry: two beams sweeping like clock hands, rings of bullets
// fired all at once, and walls of light with one gap in them.
//
// Drawn procedurally rather than from a sprite sheet, for the same reason the
// portal is: a machine made of rotating rings reads better as strokes than as
// forty pixels of hand-typed art, and it can turn at any angle for free.

import { Fireball } from './projectile.js';
import { addLight } from '../engine/postfx.js';
import { rayHitsWall } from '../world/collision.js';
import { VW, VH } from '../engine/canvas.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';

const MAX_HP = 400;

/** Head down, head half up, then the fight — the same shape as the other two. */
const WAKE = { sleep: 1.4, boot: 1.1, rise: 0.6 };
const FALL = 2.4;

const SCRIPT_1 = ['fan', 'arms', 'wall', 'fan', 'arms'];
const SCRIPT_2 = ['arms', 'fan', 'wall', 'fan', 'wall', 'random'];

const DIGITAL_LOOK = {
  core: '#031a08', mid: '#26c247', hot: '#c8ffd4',
  trail: ['#5cff7a', '#127a2c'], smoke: '#0a3d17',
  glow: 'rgba(38,194,71,ALPHA)', spark: '#5cff7a',
  pop: 'vanish', chip: 'hit',
};

/* ============================================================
   A sweeping beam — its own class, because the shared Laser bakes its
   telegraph/fire/fade into module constants and homes while it aims.
   ============================================================ */

class Beam {
  constructor(owner, angle, spin, opts = {}) {
    this.owner = owner;
    this.angle = angle;
    this.spin = spin;                 // radians per second
    this.warn = opts.warn ?? 0.7;
    this.live = opts.live ?? 3.2;
    this.damage = opts.damage ?? 14;
    this.len = 520;
    this.t = 0;
    this.dead = false;
    this.breakable = false;
    this.hitCool = 0;
  }

  get firing() { return this.t >= this.warn; }

  update(dt, player, map) {
    this.t += dt;
    if (this.t > this.warn + this.live) { this.dead = true; return; }
    if (this.firing) this.angle += this.spin * dt;
    this.hitCool = Math.max(0, this.hitCool - dt);
    if (!this.firing || this.hitCool > 0) return;

    // point-to-ray distance, and the wall has to not be in the way
    const o = this.owner;
    const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
    const px = player.x - o.x, py = player.y - o.y;
    const proj = px * dx + py * dy;
    if (proj > 0 && proj < this.len) {
      const perp = Math.abs(px * -dy + py * dx);
      if (perp < 7 && !rayHitsWall(map, o.x, o.y, player.x, player.y)) {
        player.hurt(this.damage, o.x, o.y);
        this.hitCool = 0.6;           // a sweeping beam must not tick every frame
      }
    }
  }

  reach(map) {
    const o = this.owner;
    for (let d = 8; d < this.len; d += 4) {
      if (map.solidPx(o.x + Math.cos(this.angle) * d, o.y + Math.sin(this.angle) * d)) return d;
    }
    return this.len;
  }

  draw(ctx, map) {
    const o = this.owner;
    const len = this.reach(map);
    const ex = o.x + Math.cos(this.angle) * len;
    const ey = o.y + Math.sin(this.angle) * len;

    ctx.save();
    if (!this.firing) {
      ctx.strokeStyle = 'rgba(255,51,85,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -this.t * 30;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y); ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.globalCompositeOperation = 'lighter';
    const f = 0.85 + Math.random() * 0.15;
    for (const [w, c] of [[11, 'rgba(18,122,44,0.35)'], [6, 'rgba(38,194,71,0.6)'], [2, 'rgba(200,255,212,0.95)']]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w * f;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y); ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLight(ctx, map) {
    if (!this.firing) return;
    const o = this.owner;
    const len = this.reach(map);
    for (let d = 0; d < len; d += 28) {
      addLight(ctx, o.x + Math.cos(this.angle) * d, o.y + Math.sin(this.angle) * d,
        34, 'rgba(38,194,71,ALPHA)', 0.5);
    }
  }
}

/* ============================================================
   A wall of light with one gap — the queen's tide, in green
   ============================================================ */

class Wall {
  constructor(dir, gapY, speed, damage) {
    this.dir = dir;
    this.x = dir > 0 ? -20 : VW + 20;
    this.gapY = gapY;
    this.gapH = 38;
    this.speed = speed;
    this.damage = damage;
    this.t = 0;
    this.dead = false;
    this.breakable = false;
    this.hitPlayer = false;
    this.roared = false;
  }

  get warning() { return this.t < 0.9; }

  update(dt, player) {
    this.t += dt;
    if (this.warning) return;
    if (!this.roared) { this.roared = true; sfx.laser(); cam.shake(3, 0.4); }

    this.x += this.dir * this.speed * dt;
    if (this.x < -40 || this.x > VW + 40) { this.dead = true; return; }

    if (!this.hitPlayer && Math.abs(player.x - this.x) < 11
        && Math.abs(player.y - this.gapY) > this.gapH / 2) {
      this.hitPlayer = true;
      player.hurt(this.damage, this.x - this.dir * 20, player.y);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.warning) {
      // the edge it will come from, and the height of the gap, both readable
      const x = this.dir > 0 ? 2 : VW - 4;
      ctx.fillStyle = `rgba(255,51,85,${0.3 + Math.sin(this.t * 22) * 0.2})`;
      ctx.fillRect(x, 32, 2, VH - 64);
      ctx.fillStyle = 'rgba(200,255,212,0.8)';
      ctx.fillRect(x - 1, this.gapY - this.gapH / 2, 4, this.gapH);
      ctx.restore();
      return;
    }
    for (const [y0, y1] of [[32, this.gapY - this.gapH / 2], [this.gapY + this.gapH / 2, VH - 32]]) {
      ctx.fillStyle = 'rgba(38,194,71,0.55)';
      ctx.fillRect(this.x - 5, y0, 10, y1 - y0);
      ctx.fillStyle = 'rgba(200,255,212,0.9)';
      ctx.fillRect(this.x - 1, y0, 2, y1 - y0);
    }
    ctx.restore();
  }

  drawLight(ctx) {
    if (this.warning) return;
    for (let y = 40; y < VH - 32; y += 30) {
      if (Math.abs(y - this.gapY) < this.gapH / 2) continue;
      addLight(ctx, this.x, y, 40, 'rgba(38,194,71,ALPHA)', 0.5);
    }
  }
}

/* ============================================================
   The boss
   ============================================================ */

export class Kernel {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.hw = 14; this.hh = 14;
    this.radius = 16;
    this.isBoss = true;
    this.name = 'The Kernel';
    this.maxHp = MAX_HP;
    this.hp = MAX_HP;
    this.armour = 0;
    this.solid = false;
    this.dead = false;
    this.deathT = 0;
    this.phase = 1;
    this.hurtFlash = 0;
    this.knockX = 0; this.knockY = 0;
    this.slowMul = 1; this.slowUntil = 0;
    this.keyId = null;

    this.projectiles = [];
    this.spin = 0;
    this.step = -1;
    this.t = 0;
    this.phaseFlash = 0;

    // the intro, same contract as the other two bosses
    this.state = 'sleep';
    this.awake = false;
    this.locksPlayer = true;
    this.defeatDone = false;
    this.glitchT = 0;
  }

  get script() { return this.phase === 1 ? SCRIPT_1 : SCRIPT_2; }

  hurt(amount, fromX, fromY) {
    if (this.dead || !this.awake || amount <= 0) return 0;
    this.hp -= amount;
    this.hurtFlash = 0.2;
    sfx.hit();
    P.burst(this.x, this.y, 8, {
      colour: '#5cff7a', speed: 100, life: 0.35, size: 2, drag: 0.9,
    });
    if (this.phase === 1 && this.hp <= MAX_HP / 2) this.enterPhase2();
    if (this.hp <= 0) this.die();
    return amount;
  }

  enterPhase2() {
    this.phase = 2;
    this.hp = Math.max(1, this.hp);
    this.state = 'phaseshift';
    this.t = 0;
    this.phaseFlash = 1;
    sfx.roar();
    cam.shake(8, 0.7);
  }

  die() {
    this.hp = 0;
    this.dead = true;
    this.deathT = 0;
    this.state = 'dying';
    this.locksPlayer = true;
    for (const p of this.projectiles) p.dead = true;
    sfx.death();
    cam.shake(9, 0.8);
  }

  advance() {
    this.step = (this.step + 1) % this.script.length;
    let next = this.script[this.step];
    if (next === 'random') next = Math.random() < 0.5 ? 'fan' : 'arms';
    this.begin(next);
  }

  begin(action) {
    this.t = 0;
    switch (action) {
      case 'fan':
        this.state = 'fan';
        this.fanLeft = this.phase === 2 ? 3 : 2;
        this.fanTimer = 0;
        break;
      case 'arms': {
        this.state = 'arms';
        const spin = (Math.random() > 0.5 ? 1 : -1) * (this.phase === 2 ? 1.25 : 0.85);
        const arms = this.phase === 2 ? 3 : 2;
        for (let i = 0; i < arms; i++) {
          this.projectiles.push(new Beam(this, (i / arms) * Math.PI * 2, spin, {
            damage: this.phase === 2 ? 16 : 13,
            live: this.phase === 2 ? 4 : 3.2,
          }));
        }
        sfx.charge();
        break;
      }
      case 'wall': {
        this.state = 'wall';
        const dir = Math.random() > 0.5 ? 1 : -1;
        const gap = 60 + Math.random() * (VH - 140);
        this.projectiles.push(new Wall(dir, gap, this.phase === 2 ? 140 : 108, 15));
        if (this.phase === 2) {
          this.projectiles.push(new Wall(-dir, 60 + Math.random() * (VH - 140), 120, 15));
        }
        break;
      }
      default: this.state = 'idle';
    }
  }

  /** A whole ring of bullets on one frame — nothing else in the game does this. */
  fireFan(player) {
    const n = this.phase === 2 ? 14 : 10;
    const base = Math.atan2(player.y - this.y, player.x - this.x) + Math.random() * 0.3;
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * Math.PI * 2;
      this.projectiles.push(new Fireball(this.x + Math.cos(a) * 16, this.y + Math.sin(a) * 16, a, {
        // no steering at all: a ring only reads as a ring if it keeps its shape
        look: DIGITAL_LOOK, damage: 9, speed: 74, turn: 0, homeFor: 0.1, life: 5,
      }));
    }
    sfx.fire();
    cam.shake(3, 0.2);
  }

  update(dt, player, map, solids) {
    this.t += dt;
    this.spin += dt * (this.awake ? 1.5 : 0.35);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.phaseFlash = Math.max(0, this.phaseFlash - dt * 0.8);

    for (const pr of this.projectiles) pr.update(dt, player, map);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    if (this.dead) {
      this.deathT += dt;
      if (this.deathT > FALL && !this.defeatDone) {
        this.defeatDone = true;
        this.locksPlayer = false;
      }
      return;
    }

    // ---- the intro ----
    if (!this.awake) {
      if (this.state === 'sleep' && this.t > WAKE.sleep) {
        this.state = 'boot'; this.t = 0; sfx.charge();
      } else if (this.state === 'boot' && this.t > WAKE.boot) {
        this.state = 'rise'; this.t = 0; sfx.roar(); cam.shake(6, 0.6);
      } else if (this.state === 'rise' && this.t > WAKE.rise) {
        this.awake = true;
        this.locksPlayer = false;
        this.advance();
      }
      return;
    }

    if (this.phase === 2) this.glitchT += dt;

    switch (this.state) {
      case 'idle':
        if (this.t > 0.7) this.advance();
        break;

      case 'phaseshift':
        if (this.t > 1.4) { this.state = 'idle'; this.t = 0; }
        break;

      case 'fan':
        this.fanTimer -= dt;
        if (this.fanLeft > 0 && this.fanTimer <= 0) {
          this.fanTimer = 0.75;
          this.fanLeft--;
          this.fireFan(player);
        }
        if (this.fanLeft <= 0 && this.fanTimer <= -0.5) this.advance();
        break;

      case 'arms':
        if (!this.projectiles.some((p) => p instanceof Beam)) this.advance();
        break;

      case 'wall':
        if (!this.projectiles.some((p) => p instanceof Wall)) this.advance();
        break;
    }
  }

  /** Which floor tiles are blinking out, in phase two. */
  glitchTiles() {
    if (this.phase !== 2 || this.dead) return null;
    return this.glitchT;
  }

  draw(ctx, map) {
    const dying = this.dead;
    const k = dying ? Math.min(1, this.deathT / FALL) : 0;
    const boot = this.awake ? 1 : (this.state === 'sleep' ? 0.18 : this.state === 'boot' ? 0.5 : 0.8);
    const alpha = dying ? 1 - k : 1;
    const scale = dying ? 1 - k * 0.4 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    // shadow on the floor
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 16), 16 * scale, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.scale(scale, scale);
    ctx.globalCompositeOperation = 'lighter';

    // three rings, each turning at its own rate and tilt
    for (let i = 0; i < 3; i++) {
      const r = 10 + i * 6;
      const a = this.spin * (1 + i * 0.4) + i * 1.1;
      ctx.strokeStyle = `rgba(${[38, 92, 200][i]},${[194, 255, 255][i]},${[71, 122, 212][i]},${(0.75 - i * 0.16) * boot})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * (0.4 + i * 0.2), a, 0, Math.PI * 2);
      ctx.stroke();
    }

    // the core
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
    g.addColorStop(0, `rgba(200,255,212,${0.85 * boot})`);
    g.addColorStop(0.5, `rgba(38,194,71,${0.45 * boot})`);
    g.addColorStop(1, 'rgba(3,26,8,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // phase two cracks it open — a red fault across the core
    if (this.phase === 2) {
      ctx.strokeStyle = `rgba(255,51,85,${0.7 + Math.sin(this.spin * 6) * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-11, -4); ctx.lineTo(-3, 2); ctx.lineTo(2, -3); ctx.lineTo(11, 5);
      ctx.stroke();
    }

    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.hurtFlash * 2})`;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const p of this.projectiles) p.draw(ctx, map);
  }

  drawLight(ctx, map) {
    const boot = this.awake ? 1 : 0.3;
    addLight(ctx, this.x, this.y, 90, 'rgba(38,194,71,ALPHA)',
      (this.dead ? Math.max(0, 1 - this.deathT / FALL) : 0.8) * boot);
    for (const p of this.projectiles) p.drawLight?.(ctx, map);
  }
}
