// Dragon's Servant.
//
// Tier I  : chase -> strike -> strike -> retreat -> long dash -> repeat
// Tier II : same loop but the dash fires twice, and it hits harder with more
//           health and armour. It carries the key to the next gate.

import { decodeSet, flipSet, draw, silhouette, outline } from '../engine/sprite.js';
import { SERVANT } from '../data/sprites.js';
import { moveAgainst } from '../world/collision.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';

const R = decodeSet(SERVANT, 'servant');
const L = flipSet(R, 'servantL');

const TIER = {
  1: { hp: 45, damage: 10, dashDamage: 20, speed: 46, dashes: 1, armour: 0, scale: 1,    tint: null,      light: 'rgba(230,110,40,ALPHA)' },
  2: { hp: 90, damage: 15, dashDamage: 30, speed: 54, dashes: 2, armour: 3, scale: 1.18, tint: '#6b1f8f', light: 'rgba(200,70,220,ALPHA)' },
};

// state machine, in order
const CHASE = 'chase', STRIKE = 'strike', RECOVER = 'recover', RETREAT = 'retreat',
      WINDUP = 'windup', DASH = 'dash', REST = 'rest';

export class Servant {
  constructor(x, y, tier = 1, statMul = 1) {
    const t = TIER[tier];
    this.x = x; this.y = y;
    this.tier = tier;
    // Copied, never mutated: TIER is shared by every servant in the game, and
    // book four scales its own without touching books one and two.
    this.cfg = statMul === 1 ? t : {
      ...t,
      damage: Math.round(t.damage * statMul),
      dashDamage: Math.round(t.dashDamage * statMul),
    };
    this.hw = 5; this.hh = 5;
    this.radius = 7;
    this.hp = Math.round(t.hp * statMul);
    this.maxHp = this.hp;
    this.solid = false;
    this.dead = false;
    this.deathT = 0;

    this.vx = 0; this.vy = 0;
    this.flip = false;
    this.anim = Math.random() * 4;
    this.hurtFlash = 0;
    this.knockX = 0; this.knockY = 0;

    this.state = CHASE;
    this.t = 0;
    this.strikesLeft = 2;
    this.dashesLeft = t.dashes;
    this.dashAngle = 0;
    this.hitThisAttack = false;
    this.hoverT = Math.random() * 6;
    // What this one is carrying, if anything. The gate reads its `keyId` too, so
    // the two only have to agree in the room definition — nothing here needs to
    // know which book it is standing in.
    this.keyId = tier === 2 ? 'key' : null;

    // written by WaveField, expired here
    this.slowMul = 1;
    this.slowUntil = 0;
  }

  get alive() { return !this.dead; }

  /**
   * `knockScale` is how hard this hit shoves. The wave gun passes 0: a field
   * that is supposed to hold you in the water must not punt you out of it with
   * every tick.
   */
  hurt(amount, fromX, fromY, knockScale = 1) {
    if (this.dead) return;
    // A fist (0) must stay 0 — the floor only applies to real weapons.
    const dealt = amount <= 0 ? 0 : Math.max(1, amount - this.cfg.armour);
    if (dealt <= 0) return 0;
    this.hp -= dealt;
    this.hurtFlash = 0.22;
    sfx.hit();

    const a = Math.atan2(this.y - fromY, this.x - fromX);
    const kb = (this.tier === 2 ? 90 : 150) * knockScale;
    this.knockX = Math.cos(a) * kb;
    this.knockY = Math.sin(a) * kb;

    P.burst(this.x, this.y, 8, {
      colour: this.tier === 2 ? '#c58af0' : '#cc3340',
      speed: 80, life: 0.35, size: 2, grav: 120, drag: 0.9,
    });

    if (this.hp <= 0) this.die();
    return dealt;
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    sfx.break();
    cam.shake(4, 0.3);
    P.burst(this.x, this.y, 26, {
      colour: this.tier === 2 ? '#a866e0' : '#e87a2c',
      speed: 110, life: 0.8, size: 2, grav: 90, drag: 0.9,
      glow: 14, glowColour: this.cfg.light,
    });
    P.burst(this.x, this.y, 14, { colour: '#4a0f18', speed: 60, life: 0.7, size: 2, grav: 200 });
  }

  update(dt, player, map, solids) {
    if (this.dead) { this.deathT += dt; return; }

    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.hoverT += dt;
    this.t += dt;
    if (this.slowUntil > 0) {
      this.slowUntil -= dt;
      if (this.slowUntil <= 0) this.slowMul = 1;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    if (this.state !== DASH) this.flip = dx < 0;

    const S = this.cfg.speed * this.slowMul;
    let mx = 0, my = 0;

    switch (this.state) {
      case CHASE: {
        if (dist > 20) {
          mx = (dx / dist) * S;
          my = (dy / dist) * S;
        } else {
          this.state = STRIKE;
          this.t = 0;
          this.hitThisAttack = false;
        }
        // if the player runs far away, skip straight to the dash
        if (dist > 130 && this.t > 1.2) {
          this.state = WINDUP; this.t = 0; this.dashAngle = ang;
        }
        break;
      }

      case STRIKE: {
        mx = (dx / dist) * S * 0.3;
        my = (dy / dist) * S * 0.3;
        if (this.t > 0.18 && !this.hitThisAttack) {
          this.hitThisAttack = true;
          if (dist < 26) player.hurt(Math.round(this.cfg.damage * (this.dmgMul ?? 1)), this.x, this.y);
          P.burst(this.x + Math.cos(ang) * 10, this.y + Math.sin(ang) * 10, 5, {
            colour: '#ffb648', speed: 60, life: 0.22, size: 2, glow: 10,
          });
        }
        if (this.t > 0.42) {
          this.strikesLeft--;
          if (this.strikesLeft > 0) { this.state = STRIKE; this.t = 0; this.hitThisAttack = false; }
          else { this.state = RECOVER; this.t = 0; }
        }
        break;
      }

      case RECOVER:
        if (this.t > 0.3) { this.state = RETREAT; this.t = 0; }
        break;

      case RETREAT: {
        mx = -(dx / dist) * S * 1.15;
        my = -(dy / dist) * S * 1.15;
        if (this.t > 0.75) {
          this.state = WINDUP;
          this.t = 0;
          this.dashAngle = ang;
        }
        break;
      }

      case WINDUP: {
        // brace, telegraphing the dash direction
        this.dashAngle = this.dashAngle * 0.85 + ang * 0.15;
        mx = -Math.cos(this.dashAngle) * 26;
        my = -Math.sin(this.dashAngle) * 26;
        if (this.t > 0.45) {
          this.state = DASH;
          this.t = 0;
          this.hitThisAttack = false;
          this.dashAngle = ang;
          sfx.dash();
          P.burst(this.x, this.y, 10, {
            colour: '#e87a2c', speed: 70, life: 0.3, size: 2,
            angle: this.dashAngle + Math.PI, spread: 1.2, glow: 10,
          });
        }
        break;
      }

      case DASH: {
        const speed = 330 * this.slowMul;
        mx = Math.cos(this.dashAngle) * speed;
        my = Math.sin(this.dashAngle) * speed;

        P.spawn({
          x: this.x, y: this.y, vx: -mx * 0.08, vy: -my * 0.08,
          life: 0.24, size: 3, colour: this.tier === 2 ? '#a866e0' : '#e87a2c',
          drag: 0.88, glow: 12, glowColour: this.cfg.light,
        });

        if (!this.hitThisAttack && dist < 16) {
          this.hitThisAttack = true;
          player.hurt(Math.round(this.cfg.dashDamage * (this.dmgMul ?? 1)), this.x, this.y);
          cam.shake(6, 0.3);
        }

        if (this.t > 0.34) {
          this.dashesLeft--;
          if (this.dashesLeft > 0) {
            this.state = WINDUP; this.t = 0;
          } else {
            this.state = REST; this.t = 0;
          }
        }
        break;
      }

      case REST:
        if (this.t > 0.55) {
          this.state = CHASE;
          this.t = 0;
          this.strikesLeft = 2;
          this.dashesLeft = this.cfg.dashes;
        }
        break;
    }

    // knockback + separation from other servants
    const kd = Math.pow(0.002, dt);
    this.knockX *= kd; this.knockY *= kd;

    for (const o of solids) {
      if (o === this || !(o instanceof Servant) || o.dead) continue;
      const ox = this.x - o.x, oy = this.y - o.y;
      const od = Math.hypot(ox, oy);
      if (od < 14 && od > 0.01) {
        mx += (ox / od) * 40;
        my += (oy / od) * 40;
      }
    }

    this.vx = mx; this.vy = my;
    moveAgainst(map, solids, this, (mx + this.knockX) * dt, (my + this.knockY) * dt);

    this.anim += dt * (this.state === DASH ? 14 : 7);
  }

  sprite() {
    const f = Math.floor(this.anim);
    const set = this.flip ? L : R;
    if (this.state === DASH) return set.dash[0];
    if (this.state === STRIKE || this.state === WINDUP) return set.attack[f % 2];
    if (this.hurtFlash > 0.12) return set.hurt[0];
    if (this.state === CHASE || this.state === RETREAT) return set.run[f % 3];
    return set.idle[f % 2];
  }

  draw(ctx) {
    if (this.dead) {
      if (this.deathT > 0.4) return;
      const k = this.deathT / 0.4;
      draw(ctx, silhouette(this.sprite(), '#ffb648'), this.x, this.y, {
        alpha: 1 - k, scale: this.cfg.scale * (1 + k * 0.5),
      });
      return;
    }

    const hover = Math.sin(this.hoverT * 3.4) * 1.2;
    const sc = this.cfg.scale;

    // shadow shrinks as it hovers higher — sells the flight
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 8), 6 * sc - hover * 0.3, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();

    let spr = this.sprite();

    // tier II is the same art recoloured, then rim-lit so it reads as elite
    if (this.tier === 2) {
      const key = `t2:${this.state === DASH ? 'dash' : Math.floor(this.anim) % 4}:${this.flip}`;
      spr = outline(spr, '#c58af0', 'servant2:' + key);
    }

    const wind = this.state === WINDUP ? Math.sin(this.t * 50) * 1.2 : 0;
    draw(ctx, spr, this.x + wind, this.y + hover, { scale: sc });

    if (this.hurtFlash > 0) {
      draw(ctx, silhouette(this.sprite(), '#fff'), this.x + wind, this.y + hover, {
        alpha: this.hurtFlash * 3.4, scale: sc,
      });
    }

    this.drawHealth(ctx);
  }

  drawHealth(ctx) {
    if (this.hp >= this.maxHp) return;
    const w = 14;
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - 13);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#4a0f18';
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = this.tier === 2 ? '#c58af0' : '#cc3340';
    ctx.fillRect(x, y, Math.max(0, Math.round(w * (this.hp / this.maxHp))), 2);
  }

  drawLight(ctx) {
    if (this.dead) {
      if (this.deathT < 0.4) addLight(ctx, this.x, this.y, 60, this.cfg.light, 1 - this.deathT / 0.4);
      return;
    }
    const pulse = this.state === WINDUP ? 0.6 + Math.sin(this.t * 40) * 0.4 : 0.34;
    addLight(ctx, this.x, this.y, 34, this.cfg.light, pulse);
  }
}

/**
 * Book four's servants. Same body, same numbers, same fight — but no master and
 * therefore no Dragon Key. There is no dragon down here and nothing his key
 * would open; a servant that dropped one would just be littering.
 */
export class StrayServant extends Servant {
  constructor(x, y, tier = 1, statMul = 1) {
    super(x, y, tier, statMul);
    this.name = `Stray Servant ${tier === 2 ? 'II' : 'I'}`;
    this.keyId = null;
  }
}
