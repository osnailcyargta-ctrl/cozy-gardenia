// The Drowned Queen — 300 HP, two phases, bracketed by two cutscenes.
//
// Phase 1 (300 -> 150): tide · volley · maelstrom · volley · tide · volley
// Phase 2 (150 -> 0)  : the room floods. The player wades from here on and the
//                       tides come in pairs.
//
// You do not find her in the room — you find her crown floating on the water.
// She rises out of it, and when she falls the crown is what is left behind.
//
// She is deliberately the inverse of the Dragon King. He closes distance and
// makes you dodge sideways; she takes the floor away and makes you find the one
// place worth standing.

import { decodeSet, draw, silhouette, outline } from '../engine/sprite.js';
import { QUEEN } from '../data/sprites.js';
import { moveAgainst } from '../world/collision.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';
import { Bubble } from './projectile.js';
import { VW, VH, TILE } from '../engine/canvas.js';

const Q = decodeSet(QUEEN, 'queen');

// Twice the king's original, and half again as much as his is now: she is the
// deeper book's boss and the last thing written so far. The flood still starts
// at half, because that threshold is MAX_HP / 2 rather than a number of its own.
const MAX_HP = 600;
const SCRIPT_1 = ['tide', 'volley', 'maelstrom', 'volley', 'tide', 'volley'];
const SCRIPT_2 = ['volley', 'tide', 'maelstrom', 'tide', 'random'];

// The rise, in seconds: an empty room, water gathering, the column climbing,
// and the crown coming down onto her head.
const RISE = { hidden: 0.9, stir: 0.9, climb: 1.1, crowned: 0.6 };
const SINK = 2.5;

/* ============================================================
   A wall of water crossing the room, with exactly one gap in it.
   Not a projectile: it cannot be broken, only read and stepped through.
   ============================================================ */

const TIDE_WARN = 0.9;

class Tide {
  constructor(dir, gapY, speed, damage) {
    this.dir = dir;                     // +1 sweeps right, -1 sweeps left
    this.x = dir > 0 ? -20 : VW + 20;
    this.gapY = gapY;
    this.gapH = 34;
    this.speed = speed;
    this.damage = damage;
    this.t = 0;
    this.dead = false;
    this.hitPlayer = false;
    this.breakable = false;
    this.roared = false;
  }

  get warning() { return this.t < TIDE_WARN; }

  update(dt, player) {
    this.t += dt;
    if (this.warning) return;
    if (!this.roared) { this.roared = true; sfx.tide(); cam.shake(4, 0.5); }

    this.x += this.dir * this.speed * dt;
    if (this.x < -40 || this.x > VW + 40) { this.dead = true; return; }

    // spray off the crest
    if (Math.random() > 0.25) {
      const y = 32 + Math.random() * (VH - 64);
      if (Math.abs(y - this.gapY) > this.gapH / 2) {
        P.spawn({
          x: this.x + (Math.random() - 0.5) * 8, y,
          vx: this.dir * (30 + Math.random() * 60), vy: -20 - Math.random() * 40,
          life: 0.5, size: 2, colour: Math.random() > 0.5 ? '#70dad4' : '#c4f6ef',
          drag: 0.93, grav: 90, glow: 8, glowColour: 'rgba(110,220,215,ALPHA)',
        });
      }
    }

    if (!this.hitPlayer && Math.abs(player.x - this.x) < 11
        && Math.abs(player.y - this.gapY) > this.gapH / 2) {
      this.hitPlayer = true;
      player.hurt(this.damage, this.x - this.dir * 20, player.y);
    }
  }

  draw(ctx) {
    if (this.warning) {
      // A wall you cannot break has to be legible before it arrives, so the
      // gap is drawn first and the wall only afterwards.
      const k = this.t / TIDE_WARN;
      const x = this.dir > 0 ? 2 : VW - 4;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + Math.sin(this.t * 18) * 0.15;
      ctx.fillStyle = '#38aab6';
      ctx.fillRect(x, 32, 2, VH - 64);
      ctx.globalAlpha = 0.7 * k;
      ctx.fillStyle = '#c4f6ef';
      ctx.fillRect(x - 1, this.gapY - this.gapH / 2, 4, this.gapH);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const top = 32, bot = VH - 32;
    for (const [y0, y1] of [[top, this.gapY - this.gapH / 2], [this.gapY + this.gapH / 2, bot]]) {
      if (y1 <= y0) continue;
      const g = ctx.createLinearGradient(this.x - 12, 0, this.x + 12, 0);
      g.addColorStop(0, 'rgba(14,61,79,0)');
      g.addColorStop(0.5, 'rgba(56,170,182,0.75)');
      g.addColorStop(1, 'rgba(14,61,79,0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.x - 12, y0, 24, y1 - y0);

      ctx.fillStyle = 'rgba(196,246,239,0.85)';
      for (let y = y0; y < y1; y += 3) {
        const w = 2 + Math.sin(y * 0.4 + this.t * 14) * 1.6;
        ctx.fillRect(this.x - w / 2 + Math.sin(y * 0.7 + this.t * 9) * 2, y, w, 2);
      }
    }
    ctx.restore();
  }

  drawLight(ctx) {
    if (this.warning) return;
    for (let y = 36; y < VH - 32; y += 26) {
      if (Math.abs(y - this.gapY) < this.gapH / 2) continue;
      addLight(ctx, this.x, y, 46, 'rgba(90,210,210,ALPHA)', 0.6);
    }
  }
}

/* ============================================================
   Maelstrom — a fixed whirlpool that drags you toward its centre.
   ============================================================ */

class Maelstrom {
  constructor(x, y, damage) {
    this.x = x; this.y = y;
    this.damage = damage;
    this.t = 0;
    this.life = 2.6;
    this.radius = 92;
    this.dead = false;
    this.breakable = false;
    this.tickT = 0;
    sfx.undertow();
  }

  update(dt, player) {
    this.t += dt;
    if (this.t > this.life) { this.dead = true; return; }

    const dx = this.x - player.x, dy = this.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < this.radius) {
      const grip = (1 - d / this.radius) * 340;
      // tangential component, so it spirals rather than sucking straight in
      player.knockX += (dx / d) * grip * dt * 6 - (dy / d) * grip * dt * 2.4;
      player.knockY += (dy / d) * grip * dt * 6 + (dx / d) * grip * dt * 2.4;

      this.tickT -= dt;
      if (d < 26 && this.tickT <= 0) {
        this.tickT = 0.6;
        player.hurt(this.damage, this.x, this.y);
      }
    }

    if (Math.random() > 0.2) {
      const a = Math.random() * Math.PI * 2;
      const r = this.radius * (0.5 + Math.random() * 0.5);
      P.spawn({
        x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
        vx: -Math.cos(a) * 90 - Math.sin(a) * 60,
        vy: -Math.sin(a) * 90 + Math.cos(a) * 60,
        life: 0.5, size: 2, colour: '#38aab6', drag: 0.95,
        glow: 8, glowColour: 'rgba(90,210,210,ALPHA)',
      });
    }
  }

  draw(ctx) {
    const k = 1 - this.t / this.life;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const spin = this.t * 3 + (i * Math.PI) / 2;
      ctx.strokeStyle = `rgba(112,218,212,${0.4 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s < 26; s++) {
        const a = spin + s * 0.24;
        const r = 8 + s * 3.1;
        const px = this.x + Math.cos(a) * r;
        const py = this.y + Math.sin(a) * r * 0.62;
        s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLight(ctx) {
    const k = 1 - this.t / this.life;
    addLight(ctx, this.x, this.y, this.radius, 'rgba(70,190,200,ALPHA)', 0.55 * k);
  }
}

/* ============================================================
   The Queen
   ============================================================ */

export class DrownedQueen {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.homeX = x; this.homeY = y;
    this.isBoss = true;
    this.name = 'The Drowned Queen';
    this.scale = 2;
    this.hw = 30; this.hh = 30;
    this.radius = 42;
    this.hp = MAX_HP; this.maxHp = MAX_HP;
    this.phase = 1;
    this.dead = false;
    this.deathT = 0;
    this.solid = false;

    this.flip = false;
    this.anim = 0;
    this.hurtFlash = 0;
    this.hoverT = 0;
    this.slowMul = 1; this.slowUntil = 0;

    this.step = 0;
    this.state = 'hidden';
    this.t = 0;
    this.locksPlayer = true;
    this.awake = false;
    this.defeatDone = false;
    this.crownDrift = 0;
    this.volleyLeft = 0;
    this.volleyTimer = 0;
    this.invisible = false;
    this.alpha = 1;
    this.knockX = 0; this.knockY = 0;

    this.projectiles = [];     // bubbles, tides and maelstroms all live here
    this.phaseFlash = 0;
    this.introDone = false;
    this.flooded = false;      // phase 2 leaves the room waist-deep
  }

  handX() { return this.x; }
  handY() { return this.y - 6; }

  get script() { return this.phase === 1 ? SCRIPT_1 : SCRIPT_2; }

  hurt(amount, fromX, fromY, knockScale = 1) {
    // Nothing lands before the fight starts. The player is frozen through the
    // wake-up anyway; this makes it true for everything else too.
    if (this.dead || !this.awake || this.invisible || amount <= 0) return 0;
    this.hp -= amount;
    this.hurtFlash = 0.18;
    sfx.hit();

    P.burst(this.x, this.y, 7, {
      colour: this.phase === 2 ? '#a866e0' : '#70dad4',
      speed: 70, life: 0.35, size: 2, grav: 90, drag: 0.9,
    });

    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.knockX += Math.cos(a) * 22 * knockScale;
    this.knockY += Math.sin(a) * 22 * knockScale;

    if (this.phase === 1 && this.hp <= MAX_HP / 2) this.enterPhase2();
    if (this.hp <= 0) this.die();
    return amount;
  }

  enterPhase2() {
    this.phase = 2;
    this.hp = Math.max(1, this.hp);
    this.step = 0;
    this.state = 'phaseshift';
    this.t = 0;
    this.phaseFlash = 1;
    this.flooded = true;
    sfx.tide();
    cam.shake(12, 1.2);

    for (let i = 0; i < 46; i++) {
      P.spawn({
        x: Math.random() * VW, y: VH - Math.random() * 40,
        vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 110,
        life: 0.9 + Math.random() * 0.6, size: 2 + Math.random() * 2,
        colour: ['#0e3d4f', '#38aab6', '#70dad4'][(Math.random() * 3) | 0],
        grav: 170, drag: 0.93,
      });
    }
    P.burst(this.x, this.y, 26, {
      colour: '#a866e0', speed: 140, life: 0.8, size: 2,
      glow: 18, glowColour: 'rgba(168,102,224,ALPHA)',
    });
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    this.hp = 0;
    this.flooded = false;
    this.state = 'sinking';
    this.locksPlayer = true;
    this.invisible = false;
    this.alpha = 1;
    this.crownDrift = 0;
    for (const p of this.projectiles) p.dead = true;
    sfx.death();
    cam.shake(14, 1.6);
    cam.zoomTo(this.x, this.y, 1.9, 0.9);
    P.burst(this.x, this.y, 60, {
      colour: '#c4f6ef', speed: 170, life: 1.4, size: 3, grav: 50, drag: 0.94,
      glow: 20, glowColour: 'rgba(150,240,235,ALPHA)',
    });
  }

  advance() {
    this.step = (this.step + 1) % this.script.length;
    let next = this.script[this.step];
    if (next === 'random') next = Math.random() < 0.5 ? 'tide' : 'volley';
    this.begin(next);
  }

  begin(action) {
    this.t = 0;
    switch (action) {
      case 'tide':
        this.state = 'tide';
        this.spawnTide();
        break;
      case 'volley':
        this.state = 'volley';
        this.volleyLeft = this.phase === 2 ? 5 : 3;
        this.volleyTimer = 0;
        break;
      case 'maelstrom':
        this.state = 'maelstrom';
        break;
      default:
        this.state = 'idle';
    }
  }

  spawnTide() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const gapY = 56 + Math.random() * (VH - 112);
    this.projectiles.push(new Tide(dir, gapY, this.phase === 2 ? 250 : 190, 16));
    if (this.phase === 2) {
      // a second wall right behind the first, with its own gap
      this.projectiles.push(new Tide(dir, 56 + Math.random() * (VH - 112),
        this.phase === 2 ? 250 : 190, 16));
      this.projectiles[this.projectiles.length - 1].t = -0.55;
    }
  }

  update(dt, player, map, solids) {
    for (const pr of this.projectiles) pr.update(dt, player, map);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    // The flood is the phase-2 mechanic, so it has to survive her being
    // mid-animation — but not her death, or the win lap is a slog.
    player.speedMul = this.flooded && !this.dead ? 0.68 : 1;

    if (this.dead) {
      this.deathT += dt;
      this.crownDrift += dt;
      // the column draining away
      if (this.deathT < SINK && Math.random() > 0.4) {
        P.spawn({
          x: this.x + (Math.random() - 0.5) * 60, y: this.y + 10 + Math.random() * 24,
          vx: (Math.random() - 0.5) * 60, vy: 30 + Math.random() * 60,
          life: 0.7, size: 2, colour: Math.random() > 0.5 ? '#38aab6' : '#0e3d4f',
          drag: 0.94, glow: 8, glowColour: 'rgba(90,210,210,ALPHA)',
        });
      }
      if (this.deathT >= SINK && this.locksPlayer) {
        this.locksPlayer = false;
        this.defeatDone = true;
        cam.zoomOut(0.7);
      }
      return;
    }

    // ---- she is not in the room yet, only her crown ----
    if (!this.awake) {
      this.t += dt;
      this.hoverT += dt;
      this.crownDrift += dt;

      if (this.state === 'hidden') {
        if (!this.introDone) {
          this.introDone = true;
          this.invisible = true;
          this.alpha = 0;
          cam.zoomTo(this.x, this.y + 18, 2.2, 0.85);
        }
        if (this.t > RISE.hidden) { this.state = 'stir'; this.t = 0; sfx.undertow(); }
      } else if (this.state === 'stir') {
        // water winding inward to the point she will come out of
        if (Math.random() > 0.35) {
          const a = Math.random() * Math.PI * 2;
          const r = 30 + Math.random() * 26;
          P.spawn({
            x: this.x + Math.cos(a) * r, y: this.y + 20 + Math.sin(a) * r * 0.5,
            vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 40,
            life: 0.45, size: 2, colour: '#70dad4', drag: 0.94,
            glow: 8, glowColour: 'rgba(110,220,215,ALPHA)',
          });
        }
        if (this.t > RISE.stir) { this.state = 'climb'; this.t = 0; sfx.tide(); cam.shake(5, 0.6); }
      } else if (this.state === 'climb') {
        this.invisible = false;
        this.alpha = Math.min(1, this.t / (RISE.climb * 0.8));
        if (Math.random() > 0.4) {
          P.spawn({
            x: this.x + (Math.random() - 0.5) * 50, y: this.y + 30,
            vx: (Math.random() - 0.5) * 30, vy: -70 - Math.random() * 60,
            life: 0.6, size: 2, colour: '#c4f6ef', drag: 0.93,
            glow: 10, glowColour: 'rgba(160,245,240,ALPHA)',
          });
        }
        if (this.t > RISE.climb) {
          this.state = 'crowned';
          this.t = 0;
          this.alpha = 1;
          cam.zoomOut(RISE.crowned);
        }
      } else if (this.state === 'crowned') {
        if (this.t > RISE.crowned) {
          cam.shake(7, 0.7);
          P.burst(this.x, this.y - 20, 30, {
            colour: '#e8688a', speed: 120, life: 0.7, size: 2,
            glow: 14, glowColour: 'rgba(232,104,138,ALPHA)',
          });
          this.awake = true;
          this.locksPlayer = false;
          this.step = -1;
          this.advance();
        }
      }
      return;
    }

    this.t += dt;
    this.hoverT += dt;
    this.anim += dt * 3;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.phaseFlash = Math.max(0, this.phaseFlash - dt * 0.8);
    if (this.slowUntil > 0) {
      this.slowUntil -= dt;
      if (this.slowUntil <= 0) this.slowMul = 1;
    }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    if (!this.invisible) this.flip = dx < 0;

    let mx = 0, my = 0;
    const drift = 30 * this.slowMul;

    switch (this.state) {
      case 'phaseshift':
        if (this.t > 1.5) { this.step = -1; this.advance(); }
        break;

      case 'idle':
        if (this.t > 0.5) this.advance();
        break;

      case 'tide':
        // she holds still while the room floods across
        if (this.t > (this.phase === 2 ? 2.5 : 2.1)) this.advance();
        break;

      case 'volley': {
        if (dist < 100) { mx = -(dx / dist) * drift; my = -(dy / dist) * drift; }
        else if (dist > 200) { mx = (dx / dist) * drift; my = (dy / dist) * drift; }

        this.volleyTimer -= dt;
        if (this.volleyLeft > 0 && this.volleyTimer <= 0) {
          this.volleyTimer = 0.26;
          this.volleyLeft--;
          const a = Math.atan2(player.y - this.handY(), player.x - this.handX());
          this.projectiles.push(new Bubble(this.handX(), this.handY(), a, {
            damage: 11, speed: 82,
            turn: this.phase === 2 ? 2.6 : 2,
            homeFor: this.phase === 2 ? 1.8 : 1.4,
          }));
          sfx.splash();
          P.burst(this.handX(), this.handY(), 8, {
            colour: '#c4f6ef', speed: 70, life: 0.3, size: 2,
            angle: a, spread: 1.1, glow: 12, glowColour: 'rgba(110,220,215,ALPHA)',
          });
        }
        if (this.volleyLeft <= 0 && this.volleyTimer <= -0.35) this.advance();
        break;
      }

      case 'maelstrom':
        if (this.t > 0.5 && !this.spun) {
          this.spun = true;
          this.projectiles.push(new Maelstrom(player.x, player.y, 12));
        }
        if (this.t > 3.2) { this.spun = false; this.advance(); }
        break;

    }

    const kd = Math.pow(0.004, dt);
    this.knockX *= kd; this.knockY *= kd;
    if (!this.invisible) {
      moveAgainst(map, solids, this, (mx + this.knockX) * dt, (my + this.knockY) * dt);
    }
  }

  sprite() {
    const f = Math.floor(this.anim) % 2;
    if (this.state === 'climb' || this.state === 'crowned') return Q.cast[0];
    if (this.state === 'sinking') return Q.idle[0];
    if (this.phase === 2) return Q.broken[f];
    if (this.state === 'maelstrom') return Q.pull[0];
    if (this.state === 'volley' || this.state === 'tide') return Q.cast[0];
    return Q.idle[f];
  }

  /**
   * The crown on the water: what stands in for her before she rises, and what
   * is left once she is gone. Drawn at the same 2x as she is, bobbing.
   */
  drawCrown(ctx, y, alpha = 1) {
    const bob = Math.sin(this.crownDrift * 2.2) * 1.6;
    const sway = Math.sin(this.crownDrift * 0.9) * 3;
    draw(ctx, Q.crown[0], this.x + sway, y + bob, { alpha, scale: this.scale });
  }

  draw(ctx, map) {
    for (const pr of this.projectiles) pr.draw(ctx, map);

    // ---- before she arrives ----
    if (!this.awake && !this.dead) {
      const rising = this.state === 'climb' || this.state === 'crowned';
      if (rising) {
        // she climbs out of the water; the crown rides down to meet her head
        const k = this.state === 'crowned' ? 1 : Math.min(1, this.t / RISE.climb);
        const lift = (1 - k) * 46;
        draw(ctx, this.sprite(), this.x, this.y + lift, { alpha: this.alpha, scale: this.scale });
        // She is drawn wearing a crown already, so the floating one must not
        // survive to sit next to it — it rises into her and dissolves.
        const settle = this.state === 'crowned' ? Math.min(1, this.t / RISE.crowned) : 0;
        const crownY = this.y + 34 - settle * 66 - (1 - k) * 8;
        this.drawCrown(ctx, crownY, 1 - settle * settle);
      } else {
        this.drawCrown(ctx, this.y + 34, 1);
      }
      return;
    }

    // ---- the sink ----
    if (this.dead) {
      const k = Math.min(1, this.deathT / SINK);
      // she drains downward and fades; the crown floats back up behind her
      const sink = k * 40;
      const fade = Math.max(0, 1 - k * 1.5);
      if (fade > 0.01) {
        draw(ctx, this.sprite(), this.x, this.y + sink, { alpha: fade, scale: this.scale });
        draw(ctx, silhouette(this.sprite(), '#c4f6ef'), this.x, this.y + sink,
          { alpha: fade * (1 - k) * 0.6, scale: this.scale });
      }
      // what is left of her: the crown, surfacing again
      this.drawCrown(ctx, this.y + 34, Math.min(1, k * 2));
      return;
    }

    if (this.alpha <= 0.01) return;

    const hover = Math.sin(this.hoverT * 1.7) * 2;
    let spr = this.sprite();

    ctx.save();
    ctx.globalAlpha = this.alpha * 0.42;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 38), 40, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.phase === 2) {
      spr = outline(spr, '#a866e0', `queen2:${Math.floor(this.anim) % 2}`);
    }

    const shiver = this.state === 'tide' || this.state === 'maelstrom'
      ? Math.sin(this.t * 40) * 1.2 : 0;

    draw(ctx, spr, this.x + shiver, this.y + hover, { alpha: this.alpha, scale: this.scale });

    if (this.hurtFlash > 0) {
      draw(ctx, silhouette(this.sprite(), '#fff'), this.x + shiver, this.y + hover, {
        alpha: this.hurtFlash * 4 * this.alpha, scale: this.scale,
      });
    }
    if (this.phaseFlash > 0) {
      draw(ctx, silhouette(this.sprite(), '#c4f6ef'), this.x, this.y + hover, {
        alpha: this.phaseFlash * 0.8, scale: this.scale,
      });
    }
  }

  drawLight(ctx, map) {
    for (const pr of this.projectiles) pr.drawLight(ctx, map);

    if (this.dead) {
      const k = Math.max(0, 1 - this.deathT / SINK);
      if (k > 0) addLight(ctx, this.x, this.y, 60 + 120 * k, 'rgba(150,240,235,ALPHA)', k);
      // the crown keeps its own small glow once she is gone
      addLight(ctx, this.x, this.y + 34, 40, 'rgba(232,104,138,ALPHA)', 0.5);
      return;
    }

    if (!this.awake) {
      addLight(ctx, this.x, this.y + 34, 46, 'rgba(232,104,138,ALPHA)', 0.55);
      if (this.state === 'stir' || this.state === 'climb') {
        const pull = this.state === 'climb' ? this.t / RISE.climb : this.t / RISE.stir;
        addLight(ctx, this.x, this.y + 20, 60 + pull * 70, 'rgba(90,210,210,ALPHA)', 0.4 + pull * 0.5);
      }
      if (this.alpha > 0.01) {
        addLight(ctx, this.x, this.y, 110, 'rgba(70,190,200,ALPHA)', 0.5 * this.alpha);
      }
      return;
    }
    if (this.alpha <= 0.01) return;

    const base = this.phase === 2 ? 'rgba(168,102,224,ALPHA)' : 'rgba(70,190,200,ALPHA)';
    addLight(ctx, this.x, this.y, 118, base, 0.5 * this.alpha);

    const charging = this.state === 'volley' || this.state === 'maelstrom';
    addLight(ctx, this.handX(), this.handY(), charging ? 58 : 32,
      'rgba(160,245,240,ALPHA)', (charging ? 0.9 : 0.4) * this.alpha);

    if (this.phaseFlash > 0) {
      addLight(ctx, this.x, this.y, 220 * this.phaseFlash, 'rgba(150,120,255,ALPHA)', this.phaseFlash);
    }
  }
}
