// Book two's minions.
//
// Thrall : shambles at you, winds up, lunges. Slow and stupid, but it never
//          stops, so it is a clock rather than a threat.
// Siren  : keeps its distance and *hauls you in* instead of closing — the
//          dragon's servants dash at you, so the drowned had to do the
//          opposite or book two would just be book one repainted blue.
//          chase -> pull -> two bolts -> retreat -> repeat.

import { decodeSet, draw, silhouette, outline } from '../engine/sprite.js';
import { THRALL, SIREN } from '../data/sprites.js';
import { moveAgainst } from '../world/collision.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';
import { Bubble } from './projectile.js';

const T = decodeSet(THRALL, 'thrall');
const S = decodeSet(SIREN, 'siren');

/** Shared slow bookkeeping — the wave gun writes slowMul, this expires it. */
function tickSlow(e, dt) {
  if (e.slowUntil > 0) {
    e.slowUntil -= dt;
    if (e.slowUntil <= 0) e.slowMul = 1;
  }
  return e.slowMul;
}

/** Water dripping off something that should not be walking around. */
function drip(e, chance = 0.9) {
  if (Math.random() < chance) return;
  P.spawn({
    x: e.x + (Math.random() - 0.5) * 8, y: e.y + 2,
    vx: 0, vy: 26 + Math.random() * 20,
    life: 0.4, size: 1, colour: '#38aab6', drag: 0.99,
    glow: 5, glowColour: 'rgba(90,210,210,ALPHA)',
  });
}

/* ============================================================
   Drowned Thrall
   ============================================================ */

const CHASE = 'chase', WINDUP = 'windup', LUNGE = 'lunge', REST = 'rest';

/**
 * How long a thrall stands there after a lunge. Lifted out of the state machine
 * because it is the one number here that is balance rather than animation — the
 * windup and the lunge itself are how the attack reads, and shortening or
 * stretching those would change what you are being asked to dodge.
 */
const T_REST = 1.8;

export class Thrall {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.hw = 5; this.hh = 6;
    this.radius = 7;
    this.hp = 30; this.maxHp = 30;
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
    this.t = 0;
    this.hitThisAttack = false;
    this.keyId = null;
  }

  hurt(amount, fromX, fromY, knockScale = 1) {
    if (this.dead) return 0;
    const dealt = amount <= 0 ? 0 : Math.max(1, amount - this.armour);
    if (dealt <= 0) return 0;
    this.hp -= dealt;
    this.hurtFlash = 0.22;
    sfx.hit();

    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.knockX = Math.cos(a) * 160 * knockScale;
    this.knockY = Math.sin(a) * 160 * knockScale;

    P.burst(this.x, this.y, 8, {
      colour: '#2c5638', speed: 80, life: 0.35, size: 2, grav: 120, drag: 0.9,
    });
    if (this.hp <= 0) this.die();
    return dealt;
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    sfx.splash();
    cam.shake(3, 0.24);
    P.burst(this.x, this.y, 22, {
      colour: '#38aab6', speed: 100, life: 0.7, size: 2, grav: 120, drag: 0.9,
      glow: 12, glowColour: 'rgba(90,210,210,ALPHA)',
    });
    P.burst(this.x, this.y, 12, { colour: '#2c5638', speed: 60, life: 0.7, size: 2, grav: 200 });
  }

  update(dt, player, map, solids) {
    if (this.dead) { this.deathT += dt; return; }

    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.t += dt;
    const slow = tickSlow(this, dt);
    drip(this);

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    this.flip = dx < 0;

    let mx = 0, my = 0;
    const SPEED = 34 * slow;

    switch (this.state) {
      case CHASE:
        mx = (dx / dist) * SPEED;
        my = (dy / dist) * SPEED;
        if (dist < 24) { this.state = WINDUP; this.t = 0; }
        break;

      case WINDUP:
        // rears back, telegraphing hard — the whole point of a slow enemy is
        // that you always have time to answer it
        mx = -(dx / dist) * 18 * slow;
        my = -(dy / dist) * 18 * slow;
        if (this.t > 0.5) {
          this.state = LUNGE; this.t = 0; this.hitThisAttack = false;
          this.lungeAngle = ang;
          sfx.dash();
        }
        break;

      case LUNGE: {
        const sp = 190 * slow;
        mx = Math.cos(this.lungeAngle) * sp;
        my = Math.sin(this.lungeAngle) * sp;
        if (!this.hitThisAttack && dist < 16) {
          this.hitThisAttack = true;
          player.hurt(8, this.x, this.y);
        }
        if (this.t > 0.3) { this.state = REST; this.t = 0; }
        break;
      }

      case REST:
        if (this.t > T_REST) { this.state = CHASE; this.t = 0; }
        break;
    }

    const kd = Math.pow(0.002, dt);
    this.knockX *= kd; this.knockY *= kd;

    for (const o of solids) {
      if (o === this || o.dead || !(o instanceof Thrall)) continue;
      const ox = this.x - o.x, oy = this.y - o.y;
      const od = Math.hypot(ox, oy);
      if (od < 13 && od > 0.01) { mx += (ox / od) * 34; my += (oy / od) * 34; }
    }

    this.vx = mx; this.vy = my;
    moveAgainst(map, solids, this, (mx + this.knockX) * dt, (my + this.knockY) * dt);
    this.anim += dt * (this.state === LUNGE ? 12 : 4.5);
  }

  sprite() {
    const f = Math.floor(this.anim);
    if (this.hurtFlash > 0.12) return T.hurt[0];
    if (this.state === WINDUP) return T.attack[0];
    if (this.state === LUNGE) return T.attack[1];
    if (this.state === CHASE) return T.run[f % 3];
    return T.idle[f % 2];
  }

  draw(ctx) {
    if (this.dead) {
      if (this.deathT > 0.4) return;
      const k = this.deathT / 0.4;
      draw(ctx, silhouette(this.sprite(), '#70dad4'), this.x, this.y, {
        alpha: 1 - k, scale: 1 + k * 0.4, flip: this.flip,
      });
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 7), 5.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const shiver = this.state === WINDUP ? Math.sin(this.t * 44) * 1.1 : 0;
    draw(ctx, this.sprite(), this.x + shiver, this.y, { flip: this.flip });

    if (this.hurtFlash > 0) {
      draw(ctx, silhouette(this.sprite(), '#fff'), this.x + shiver, this.y, {
        alpha: this.hurtFlash * 3.4, flip: this.flip,
      });
    }
    drawHealth(ctx, this, '#38aab6');
  }

  drawLight(ctx) {
    if (this.dead) {
      if (this.deathT < 0.4) addLight(ctx, this.x, this.y, 50, 'rgba(90,210,210,ALPHA)', 1 - this.deathT / 0.4);
      return;
    }
    addLight(ctx, this.x, this.y - 3, 30, 'rgba(90,210,210,ALPHA)', 0.32);
  }
}

/* ============================================================
   Siren
   ============================================================ */

const S_CHASE = 'chase', S_PULLWIND = 'pullwind', S_PULL = 'pull',
      S_BOLT = 'bolt', S_RETREAT = 'retreat', S_REST = 'rest';

/**
 * `rearm` is how long a siren circles you before winding up again — the gap
 * between attacks, not the attack. It lives in the table rather than inline in
 * the state machine because it is the knob balance actually wants, and because
 * the two tiers should be able to differ on it later without another rewrite.
 * Everything else about the attack — the 0.55s telegraph, the pull, the spacing
 * of the bolts — is deliberately left alone: those are what you read and react
 * to, and stretching them would change the fight rather than its pace.
 */
const S_TIER = {
  1: { hp: 55, speed: 40, bolts: 2, boltDamage: 9,  pullDamage: 6,  armour: 0, rearm: 2.2, scale: 1,    rim: null,      light: 'rgba(90,210,210,ALPHA)' },
  2: { hp: 100, speed: 48, bolts: 3, boltDamage: 13, pullDamage: 10, armour: 3, rearm: 2.2, scale: 1.18, rim: '#e8688a', light: 'rgba(232,104,138,ALPHA)' },
};

export class Siren {
  constructor(x, y, tier = 1, statMul = 1) {
    const base = S_TIER[tier];
    const cfg = statMul === 1 ? base : {
      ...base,
      boltDamage: Math.round(base.boltDamage * statMul),
      pullDamage: Math.round(base.pullDamage * statMul),
    };
    this.x = x; this.y = y;
    this.tier = tier;
    this.cfg = cfg;
    this.hw = 5; this.hh = 6;
    this.radius = 8;
    this.hp = Math.round(base.hp * statMul); this.maxHp = this.hp;
    this.solid = false;
    this.dead = false;
    this.deathT = 0;
    this.vx = 0; this.vy = 0;
    this.flip = false;
    this.anim = Math.random() * 4;
    this.hurtFlash = 0;
    this.knockX = 0; this.knockY = 0;
    this.hoverT = Math.random() * 6;
    this.slowMul = 1; this.slowUntil = 0;

    this.state = S_CHASE;
    this.t = 0;
    this.boltsLeft = cfg.bolts;
    this.boltTimer = 0;
    this.pulled = false;
    this.keyId = tier === 2 ? 'coral_key' : null;
    this.projectiles = [];
  }

  hurt(amount, fromX, fromY, knockScale = 1) {
    if (this.dead) return 0;
    const dealt = amount <= 0 ? 0 : Math.max(1, amount - this.cfg.armour);
    if (dealt <= 0) return 0;
    this.hp -= dealt;
    this.hurtFlash = 0.22;
    sfx.hit();

    const a = Math.atan2(this.y - fromY, this.x - fromX);
    const kb = (this.tier === 2 ? 80 : 130) * knockScale;
    this.knockX = Math.cos(a) * kb;
    this.knockY = Math.sin(a) * kb;

    P.burst(this.x, this.y, 8, {
      colour: this.tier === 2 ? '#e8688a' : '#70dad4',
      speed: 80, life: 0.35, size: 2, grav: 110, drag: 0.9,
    });
    if (this.hp <= 0) this.die();
    return dealt;
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    for (const p of this.projectiles) p.dead = true;
    sfx.splash();
    cam.shake(4, 0.3);
    P.burst(this.x, this.y, 26, {
      colour: this.tier === 2 ? '#e8688a' : '#70dad4',
      speed: 110, life: 0.8, size: 2, grav: 80, drag: 0.9,
      glow: 14, glowColour: this.cfg.light,
    });
    P.burst(this.x, this.y, 14, { colour: '#082733', speed: 60, life: 0.7, size: 2, grav: 190 });
  }

  update(dt, player, map, solids) {
    for (const pr of this.projectiles) pr.update(dt, player, map);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    if (this.dead) { this.deathT += dt; return; }

    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.hoverT += dt;
    this.t += dt;
    const slow = tickSlow(this, dt);
    drip(this, 0.95);

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    this.flip = dx < 0;

    const SPEED = this.cfg.speed * slow;
    let mx = 0, my = 0;

    switch (this.state) {
      case S_CHASE:
        // wants to be at arm's length, not on top of you
        if (dist > 76) { mx = (dx / dist) * SPEED; my = (dy / dist) * SPEED; }
        else if (dist < 46) { mx = -(dx / dist) * SPEED * 0.8; my = -(dy / dist) * SPEED * 0.8; }
        if (this.t > this.cfg.rearm && dist < 110) { this.state = S_PULLWIND; this.t = 0; this.pulled = false; }
        break;

      case S_PULLWIND: {
        // arms up, water spiralling inward — the tell for the drag
        if (Math.random() > 0.45) {
          const a = Math.random() * Math.PI * 2;
          const r = 22 + Math.random() * 14;
          P.spawn({
            x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
            vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60,
            life: 0.35, size: 2, colour: '#70dad4', drag: 0.95,
            glow: 8, glowColour: this.cfg.light,
          });
        }
        if (this.t > 0.55) { this.state = S_PULL; this.t = 0; sfx.undertow(); }
        break;
      }

      case S_PULL: {
        // Reeled in rather than run down: knockback pointing the wrong way.
        // It is answerable — dash out of it, or take the hit and close.
        if (dist < 140) {
          const grip = (1 - dist / 140) * 520;
          player.knockX -= Math.cos(ang) * grip * dt * 6;
          player.knockY -= Math.sin(ang) * grip * dt * 6;
        }
        if (!this.pulled && dist < 26) {
          this.pulled = true;
          player.hurt(this.cfg.pullDamage, this.x, this.y);
        }
        if (this.t > 0.5) {
          this.state = S_BOLT; this.t = 0;
          this.boltsLeft = this.cfg.bolts; this.boltTimer = 0;
        }
        break;
      }

      case S_BOLT: {
        if (dist < 50) { mx = -(dx / dist) * SPEED * 0.7; my = -(dy / dist) * SPEED * 0.7; }
        this.boltTimer -= dt;
        if (this.boltsLeft > 0 && this.boltTimer <= 0) {
          this.boltTimer = 0.28;
          this.boltsLeft--;
          this.projectiles.push(new Bubble(this.x, this.y - 2, ang, {
            damage: this.cfg.boltDamage, speed: 74, turn: 1.9, homeFor: 1.2, life: 3.4,
          }));
          sfx.splash();
        }
        if (this.boltsLeft <= 0 && this.boltTimer <= -0.3) { this.state = S_RETREAT; this.t = 0; }
        break;
      }

      case S_RETREAT:
        mx = -(dx / dist) * SPEED * 1.2;
        my = -(dy / dist) * SPEED * 1.2;
        if (this.t > 0.7) { this.state = S_REST; this.t = 0; }
        break;

      case S_REST:
        if (this.t > 0.4) { this.state = S_CHASE; this.t = 0; }
        break;
    }

    const kd = Math.pow(0.002, dt);
    this.knockX *= kd; this.knockY *= kd;

    for (const o of solids) {
      if (o === this || o.dead || !(o instanceof Siren)) continue;
      const ox = this.x - o.x, oy = this.y - o.y;
      const od = Math.hypot(ox, oy);
      if (od < 16 && od > 0.01) { mx += (ox / od) * 40; my += (oy / od) * 40; }
    }

    this.vx = mx; this.vy = my;
    moveAgainst(map, solids, this, (mx + this.knockX) * dt, (my + this.knockY) * dt);
    this.anim += dt * (this.state === S_CHASE || this.state === S_RETREAT ? 7 : 5);
  }

  sprite() {
    const f = Math.floor(this.anim);
    if (this.hurtFlash > 0.12) return S.hurt[0];
    if (this.state === S_PULLWIND) return S.attack[0];
    if (this.state === S_PULL || this.state === S_BOLT) return S.attack[1];
    if (this.state === S_CHASE || this.state === S_RETREAT) return S.run[f % 3];
    return S.idle[f % 2];
  }

  draw(ctx) {
    for (const pr of this.projectiles) pr.draw(ctx);

    if (this.dead) {
      if (this.deathT > 0.4) return;
      const k = this.deathT / 0.4;
      draw(ctx, silhouette(this.sprite(), '#c4f6ef'), this.x, this.y, {
        alpha: 1 - k, scale: this.cfg.scale * (1 + k * 0.5),
      });
      return;
    }

    const hover = Math.sin(this.hoverT * 3.1) * 1.3;
    const sc = this.cfg.scale;

    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 9), 5.5 * sc - hover * 0.3, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    let spr = this.sprite();
    if (this.cfg.rim) {
      const key = `s2:${this.state}:${Math.floor(this.anim) % 4}`;
      spr = outline(spr, this.cfg.rim, 'siren2:' + key);
    }

    const shiver = this.state === S_PULLWIND ? Math.sin(this.t * 46) * 1.2 : 0;
    draw(ctx, spr, this.x + shiver, this.y + hover, { scale: sc });

    if (this.hurtFlash > 0) {
      draw(ctx, silhouette(this.sprite(), '#fff'), this.x + shiver, this.y + hover, {
        alpha: this.hurtFlash * 3.4, scale: sc,
      });
    }
    drawHealth(ctx, this, this.tier === 2 ? '#e8688a' : '#70dad4');
  }

  drawLight(ctx) {
    for (const pr of this.projectiles) pr.drawLight(ctx);
    if (this.dead) {
      if (this.deathT < 0.4) addLight(ctx, this.x, this.y, 60, this.cfg.light, 1 - this.deathT / 0.4);
      return;
    }
    const pulse = this.state === S_PULLWIND || this.state === S_PULL
      ? 0.65 + Math.sin(this.t * 34) * 0.35 : 0.36;
    addLight(ctx, this.x, this.y, 38, this.cfg.light, pulse);
  }
}

/* ------------------------------------------------------------ */

function drawHealth(ctx, e, colour) {
  if (e.hp >= e.maxHp) return;
  const w = 14;
  const x = Math.round(e.x - w / 2);
  const y = Math.round(e.y - 13);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = '#082733';
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, Math.max(0, Math.round(w * (e.hp / e.maxHp))), 2);
}
