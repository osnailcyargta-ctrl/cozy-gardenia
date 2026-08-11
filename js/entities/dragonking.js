// The Dragon King — 300 HP, two phases.
//
// Phase 1 (300 -> 150): dash · volley · dash · volley · volley · laser · repeat
// Phase 2 (150 -> 0)  : wings are shredded, so no more dashing. Instead it can
//                       vanish for 2s and reappear behind the player.
//                       volley · volley · laser · vanish · (laser|volley) · repeat

import { decodeSet, flipSet, draw, silhouette, outline } from '../engine/sprite.js';
import { KING } from '../data/sprites.js';
import { moveAgainst } from '../world/collision.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';
import { Fireball, Laser } from './projectile.js';
import { VW, VH, TILE } from '../engine/canvas.js';

const R = decodeSet(KING, 'king');
const L = flipSet(R, 'kingL');

const MAX_HP = 300;

// Phase 1 script. 'volley' fires three curving fireballs 0.3s apart.
const SCRIPT_1 = ['dash', 'volley', 'dash', 'volley', 'volley', 'laser'];
// Phase 2 script; the final step is chosen at random each cycle.
const SCRIPT_2 = ['volley', 'volley', 'laser', 'vanish', 'random'];

export class DragonKing {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.homeX = x; this.homeY = y;
    // Drawn at 2x: a 40x32 sprite reads as a trinket next to a 16px player,
    // not as the thing the whole book builds toward. Hitbox follows the art.
    this.scale = 2;
    this.hw = 26; this.hh = 18;
    this.radius = 32;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.phase = 1;
    this.dead = false;
    this.deathT = 0;
    this.solid = false;

    this.flip = true;                 // faces left toward the player's entrance
    this.anim = 0;
    this.hurtFlash = 0;
    this.hoverT = 0;

    this.step = 0;
    this.state = 'intro';
    this.t = 0;
    this.volleyLeft = 0;
    this.volleyTimer = 0;
    this.dashAngle = 0;
    this.hitThisDash = false;
    this.invisible = false;
    this.alpha = 1;
    this.knockX = 0; this.knockY = 0;

    this.projectiles = [];
    this.phaseFlash = 0;
    this.introDone = false;
  }

  /** Where fire comes out — tracks the sprite's mouth. */
  mouthX() { return this.x + (this.flip ? -30 : 30); }
  mouthY() { return this.y + 6; }

  get script() { return this.phase === 1 ? SCRIPT_1 : SCRIPT_2; }

  hurt(amount, fromX, fromY) {
    if (this.dead || this.invisible) return 0;
    this.hp -= amount;
    this.hurtFlash = 0.18;
    sfx.hit();

    P.burst(this.x, this.y, 7, {
      colour: this.phase === 2 ? '#c58af0' : '#e87a2c',
      speed: 70, life: 0.35, size: 2, grav: 100, drag: 0.9,
    });

    // light knockback only — a boss shouldn't be shoved around
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.knockX += Math.cos(a) * 26;
    this.knockY += Math.sin(a) * 26;

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
    sfx.roar();
    cam.shake(11, 1.1);

    // wings tear apart
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      P.spawn({
        x: this.x + (Math.random() - 0.5) * 40,
        y: this.y - 8 + (Math.random() - 0.5) * 24,
        vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 40,
        life: 0.9 + Math.random() * 0.5, size: 2 + Math.random() * 2,
        colour: ['#8f2f16', '#c4491d', '#4a0f18'][(Math.random() * 3) | 0],
        grav: 180, drag: 0.92,
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
    for (const p of this.projectiles) p.dead = true;
    sfx.death();
    cam.shake(14, 1.6);
    P.burst(this.x, this.y, 60, {
      colour: '#ffb648', speed: 170, life: 1.4, size: 3, grav: 60, drag: 0.94,
      glow: 20, glowColour: 'rgba(255,170,60,ALPHA)',
    });
  }

  /* -------------------------------------------------- */

  advance() {
    this.step = (this.step + 1) % this.script.length;
    let next = this.script[this.step];
    if (next === 'random') next = Math.random() < 0.5 ? 'laser' : 'volley';
    this.begin(next);
  }

  begin(action) {
    this.t = 0;
    this.hitThisDash = false;

    switch (action) {
      case 'dash':
        this.state = 'dashwind';
        break;
      case 'volley':
        this.state = 'volley';
        this.volleyLeft = 3;
        this.volleyTimer = 0;
        break;
      case 'laser':
        this.state = 'laserwind';
        break;
      case 'vanish':
        this.state = 'vanish';
        this.invisible = false;
        sfx.vanish();
        P.burst(this.x, this.y, 30, {
          colour: '#a866e0', speed: 110, life: 0.6, size: 2,
          glow: 16, glowColour: 'rgba(168,102,224,ALPHA)',
        });
        break;
      default:
        this.state = 'idle';
    }
  }

  update(dt, player, map, solids) {
    // projectiles keep living even after the boss dies, so they can fade out
    for (const pr of this.projectiles) pr.update(dt, player, map);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    if (this.dead) { this.deathT += dt; return; }

    this.t += dt;
    this.hoverT += dt;
    this.anim += dt * 3.4;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.phaseFlash = Math.max(0, this.phaseFlash - dt * 0.8);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    if (this.state !== 'dash' && !this.invisible) this.flip = dx < 0;

    let mx = 0, my = 0;

    switch (this.state) {
      case 'intro':
        if (!this.introDone) { this.introDone = true; sfx.roar(); cam.shake(7, 1); }
        if (this.t > 1.4) { this.step = -1; this.advance(); }
        break;

      case 'phaseshift':
        if (this.t > 1.5) { this.step = -1; this.advance(); }
        break;

      case 'idle':
        if (this.t > 0.6) this.advance();
        break;

      // ---------- dash ----------
      case 'dashwind': {
        this.dashAngle = ang;
        mx = -Math.cos(ang) * 40;
        my = -Math.sin(ang) * 40;
        if (this.t > 0.6) {
          this.state = 'dash';
          this.t = 0;
          this.hitThisDash = false;
          sfx.dash();
          cam.shake(4, 0.2);
        }
        break;
      }

      case 'dash': {
        const sp = 300;
        mx = Math.cos(this.dashAngle) * sp;
        my = Math.sin(this.dashAngle) * sp;

        P.spawn({
          x: this.x - Math.cos(this.dashAngle) * 12,
          y: this.y + 4,
          vx: -mx * 0.1, vy: -my * 0.1 - 20,
          life: 0.3, size: 3, colour: '#8f2f16', drag: 0.9,
          glow: 12, glowColour: 'rgba(230,110,40,ALPHA)',
        });

        if (!this.hitThisDash && dist < 26) {
          this.hitThisDash = true;
          player.hurt(5, this.x, this.y);
          cam.shake(8, 0.35);
        }
        if (this.t > 0.5) { this.state = 'recover'; this.t = 0; }
        break;
      }

      case 'recover':
        if (this.t > 0.45) this.advance();
        break;

      // ---------- fireball volley ----------
      case 'volley': {
        // drift slowly, keeping distance
        if (dist < 90) { mx = -(dx / dist) * 34; my = -(dy / dist) * 34; }
        else if (dist > 190) { mx = (dx / dist) * 34; my = (dy / dist) * 34; }

        this.volleyTimer -= dt;
        if (this.volleyLeft > 0 && this.volleyTimer <= 0) {
          this.volleyTimer = 0.3;                    // 0.3s between each ball
          this.volleyLeft--;
          const a = Math.atan2(player.y - this.mouthY(), player.x - this.mouthX());
          this.projectiles.push(new Fireball(this.mouthX(), this.mouthY(), a, {
            damage: 3,
            speed: 92,
            turn: this.phase === 2 ? 2.9 : 2.2,
            homeFor: this.phase === 2 ? 1.9 : 1.5,
          }));
          sfx.fire();
          P.burst(this.mouthX(), this.mouthY(), 8, {
            colour: '#ffb648', speed: 70, life: 0.3, size: 2,
            angle: a, spread: 1.1, glow: 12, glowColour: 'rgba(255,160,60,ALPHA)',
          });
        }
        if (this.volleyLeft <= 0 && this.volleyTimer <= -0.35) this.advance();
        break;
      }

      // ---------- laser ----------
      case 'laserwind':
        if (this.t > 0.25) {
          this.state = 'laser';
          this.t = 0;
          this.projectiles.push(new Laser(this, ang, { damage: 4, len: 560 }));
        }
        break;

      case 'laser':
        if (this.t > 1.45) this.advance();
        break;

      // ---------- vanish (phase 2 only) ----------
      case 'vanish': {
        if (this.t < 0.3) {
          this.alpha = 1 - this.t / 0.3;
        } else if (this.t < 2.3) {
          // gone for 2 seconds
          this.invisible = true;
          this.alpha = 0;
          if (Math.random() > 0.75) {
            P.spawn({
              x: this.homeX + (Math.random() - 0.5) * VW * 0.6,
              y: this.homeY + (Math.random() - 0.5) * 90,
              vx: 0, vy: -18, life: 0.7, size: 2, colour: '#a866e0',
              glow: 8, glowColour: 'rgba(168,102,224,ALPHA)',
            });
          }
        } else if (this.t < 2.45) {
          // reappear behind the player, clamped inside the room
          if (this.invisible) {
            this.invisible = false;
            const behind = Math.atan2(player.y - this.y, player.x - this.x);
            let nx = player.x + Math.cos(behind) * 46;
            let ny = player.y + Math.sin(behind) * 46;
            nx = Math.max(TILE * 2.5, Math.min(VW - TILE * 2.5, nx));
            ny = Math.max(TILE * 3, Math.min(VH - TILE * 3, ny));
            this.x = nx; this.y = ny;
            this.flip = player.x < this.x;
            sfx.appear();
            cam.shake(5, 0.3);
            P.burst(this.x, this.y, 26, {
              colour: '#c58af0', speed: 120, life: 0.55, size: 2,
              glow: 16, glowColour: 'rgba(200,140,255,ALPHA)',
            });
          }
          this.alpha = (this.t - 2.3) / 0.15;
        } else {
          this.alpha = 1;
          this.advance();
        }
        break;
      }
    }

    // hover drift + knockback
    const kd = Math.pow(0.004, dt);
    this.knockX *= kd; this.knockY *= kd;

    if (!this.invisible) {
      moveAgainst(map, solids, this, (mx + this.knockX) * dt, (my + this.knockY) * dt);
    }
  }

  sprite() {
    const set = this.flip ? L : R;
    const f = Math.floor(this.anim) % 2;
    if (this.phase === 2) return set.broken[f];
    if (this.state === 'laserwind' || this.state === 'laser' || this.state === 'volley') {
      return set.breathe[0];
    }
    return set.idle[f];
  }

  draw(ctx, map) {
    for (const pr of this.projectiles) pr.draw(ctx, map);

    if (this.dead) {
      const k = Math.min(1, this.deathT / 1.2);
      if (k >= 1) return;
      const spr = this.sprite();
      ctx.save();
      ctx.globalAlpha = 1 - k;
      draw(ctx, silhouette(spr, k > 0.5 ? '#4a0f18' : '#ffb648'), this.x, this.y + k * 10, { alpha: 1 - k, scale: this.scale });
      ctx.restore();
      return;
    }

    if (this.alpha <= 0.01) return;

    const hover = Math.sin(this.hoverT * 1.9) * 2.2;
    let spr = this.sprite();

    // shadow
    ctx.save();
    ctx.globalAlpha = this.alpha * 0.45;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 28), 36, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // phase 2 gets an arcane rim so the silhouette still reads once the wings go
    if (this.phase === 2) {
      spr = outline(spr, '#a866e0', `king2:${this.flip}:${Math.floor(this.anim) % 2}`);
    }

    const shiver = this.state === 'dashwind' || this.state === 'laserwind'
      ? Math.sin(this.t * 46) * 1.4 : 0;

    draw(ctx, spr, this.x + shiver, this.y + hover, { alpha: this.alpha, scale: this.scale });

    if (this.hurtFlash > 0) {
      draw(ctx, silhouette(this.sprite(), '#fff'), this.x + shiver, this.y + hover, {
        alpha: this.hurtFlash * 4 * this.alpha, scale: this.scale,
      });
    }
    if (this.phaseFlash > 0) {
      draw(ctx, silhouette(this.sprite(), '#c58af0'), this.x, this.y + hover, {
        alpha: this.phaseFlash * 0.8, scale: this.scale,
      });
    }
  }

  drawLight(ctx, map) {
    for (const pr of this.projectiles) pr.drawLight(ctx, map);

    if (this.dead) {
      if (this.deathT < 1.2) {
        addLight(ctx, this.x, this.y, 160 * (1 - this.deathT / 1.2), 'rgba(255,170,60,ALPHA)', 1 - this.deathT / 1.2);
      }
      return;
    }
    if (this.alpha <= 0.01) return;

    const base = this.phase === 2 ? 'rgba(168,102,224,ALPHA)' : 'rgba(230,110,40,ALPHA)';
    addLight(ctx, this.x, this.y, 120, base, 0.5 * this.alpha);

    // the eye / mouth glow, brighter while winding up
    const charging = this.state === 'laserwind' || this.state === 'volley';
    addLight(ctx, this.mouthX(), this.mouthY(), charging ? 60 : 34,
      'rgba(255,190,80,ALPHA)', (charging ? 0.9 : 0.4) * this.alpha);

    if (this.phaseFlash > 0) {
      addLight(ctx, this.x, this.y, 220 * this.phaseFlash, 'rgba(190,120,255,ALPHA)', this.phaseFlash);
    }
  }
}
