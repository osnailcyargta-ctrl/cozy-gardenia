import { decodeSet, flipSet, draw, silhouette } from '../engine/sprite.js';
import { PLAYER } from '../data/sprites.js';
import { axis, isDown } from '../engine/input.js';
import { moveAgainst } from '../world/collision.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { FIST } from '../data/items.js';
import * as cam from '../engine/camera.js';
import { dev } from '../systems/dev.js';

const A = decodeSet(PLAYER, 'player');
const LEFT = flipSet({ sideIdle: A.sideIdle, sideWalk: A.sideWalk }, 'playerL');

const SPEED = 74;
const ACCEL = 900;
const FRICTION = 0.0001;

// Dash: a short committed burst, not a speed toggle. The i-frames are the whole
// point — it exists so a telegraphed laser or a servant dash can be answered.
const DASH_SPEED = 700;
const DASH_TIME = 0.19;
const DASH_COOLDOWN = 0.75;
const DASH_IFRAMES = 0.26;

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hw = 4; this.hh = 5;      // collision box is small: feet only
    this.radius = 6;
    this.maxHp = 100;
    this.hp = 100;
    this.facing = 'down';
    this.flip = false;
    this.anim = 0;
    this.moving = false;

    this.weapon = FIST;
    this.attackT = 0;
    this.cooldown = 0;
    // Which face of a two-mode weapon is live. Only the claw has two; the
    // number rides on the player so it survives swapping hotbar slots and
    // walking between books.
    this.clawMode = 1;
    this.throwCool = 0;
    this.attackAngle = 0;
    this.swungThisAttack = false;

    this.invuln = 0;
    this.hurtFlash = 0;
    this.knockX = 0; this.knockY = 0;
    this.dead = false;
    this.deathT = 0;

    this.bobT = 0;
    this.stepT = 0;

    // Scaled by the world, not by the player: book two's boss floods the room
    // and everyone in it wades from then on.
    this.speedMul = 1;
    // A timed slow, kept apart from speedMul because the world rewrites that one
    // every frame — book two's flood sets it from scratch, so a slow parked
    // there would be wiped before it was ever felt.
    this.slowFactor = 1;
    this.slowUntil = 0;

    // Set while a boss is waking up or dying. The player still breathes and
    // blinks — they just don't get to act during someone else's moment.
    this.frozen = false;

    this.dashT = 0;
    this.dashCd = 0;
    this.dashX = 1; this.dashY = 0;
    this.ghosts = [];        // afterimages, drawn behind the player
  }

  get dashing() { return this.dashT > 0; }

  /** Returns true if the dash actually started. */
  startDash(dx, dy) {
    if (this.dashCd > 0 || this.dashing || this.dead || this.frozen) return false;
    // no direction held: dash the way you are facing
    if (!dx && !dy) {
      if (this.facing === 'side') { dx = this.flip ? -1 : 1; dy = 0; }
      else if (this.facing === 'up') { dx = 0; dy = -1; }
      else { dx = 0; dy = 1; }
    }
    const l = Math.hypot(dx, dy) || 1;
    this.dashX = dx / l; this.dashY = dy / l;
    this.dashT = DASH_TIME;
    this.dashCd = DASH_COOLDOWN;
    this.invuln = Math.max(this.invuln, DASH_IFRAMES);
    this.ghosts.length = 0;
    sfx.dash();

    P.burst(this.x, this.y + 4, 10, {
      colour: '#6d8cc0', speed: 70, life: 0.3, size: 2, drag: 0.88,
      angle: Math.atan2(-this.dashY, -this.dashX), spread: 1.2,
      glow: 8, glowColour: 'rgba(150,180,255,ALPHA)',
    });
    return true;
  }

  get attacking() { return this.attackT > 0; }

  hurt(amount, fromX, fromY) {
    // Godmode is a flag rather than a huge `invuln`, because invuln is a
    // countdown that half the game writes to — it would be switched off again
    // by the next doorway.
    if (dev.god) return false;
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= amount;
    this.invuln = 0.75;
    this.hurtFlash = 0.3;
    sfx.hurt();
    cam.shake(5, 0.28);

    if (fromX !== undefined) {
      const a = Math.atan2(this.y - fromY, this.x - fromX);
      this.knockX = Math.cos(a) * 170;
      this.knockY = Math.sin(a) * 170;
      cam.push(this.x - fromX, this.y - fromY, 5);
    }

    P.burst(this.x, this.y, 12, {
      colour: '#cc3340', speed: 90, life: 0.45, size: 2, grav: 180, drag: 0.9,
    });

    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathT = 0;
      sfx.death();
      cam.shake(9, 0.7);
      P.burst(this.x, this.y, 30, { colour: '#8f1c26', speed: 120, life: 0.9, size: 2, grav: 200 });
    }
    return true;
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  /**
   * Book three's nullbytes do not take health, they take the top off the bar.
   * It lasts as long as you stay in that book — the library hands out a fresh
   * Player, so walking home is what undoes it.
   */
  /** Corrupt II also drags you: half speed for three seconds. */
  slow(factor, seconds) {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowUntil = Math.max(this.slowUntil, seconds);
  }

  corrupt(n, floor) {
    if (this.maxHp <= floor) return false;
    this.maxHp = Math.max(floor, this.maxHp - n);
    this.hp = Math.min(this.hp, this.maxHp);
    this.hurtFlash = 0.4;
    return true;
  }

  startAttack(angle) {
    // Blocked by the swing as well as by the cooldown. Most weapons animate for
    // 0.2s and that is shorter than their cooldown anyway, so this only bites on
    // the claw — whose whole point is that the animation runs first and the
    // cooldown only starts once it is over.
    if (this.cooldown > 0 || this.attackT > 0 || this.dead || this.frozen) return false;
    this.attackAngle = angle;
    this.attackT = this.weapon.swing ?? 0.2;
    // A weapon that names its own swing gets the sequential rule the claw was
    // specified with: the animation runs, and only then does the cooldown start.
    // Everything else keeps the cooldown it has always had — stacking the 0.2s
    // animation onto the sword would have quietly slowed every weapon in the game.
    this.cooldown = this.weapon.swing === undefined
      ? this.weapon.cooldown
      : this.attackT + this.weapon.cooldown;
    this.swungThisAttack = false;
    this.sigThisAttack = false;
    sfx.swing();

    // face the swing
    const a = angle;
    if (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))) {
      this.facing = 'side';
      this.flip = Math.cos(a) < 0;
    } else {
      this.facing = Math.sin(a) > 0 ? 'down' : 'up';
    }

    // swing trail
    const r = this.weapon.range * 0.7;
    for (let i = 0; i < 7; i++) {
      const t = (i / 6 - 0.5) * this.weapon.arc;
      P.spawn({
        x: this.x + Math.cos(a + t) * r,
        y: this.y - 3 + Math.sin(a + t) * r,
        vx: Math.cos(a + t) * 24, vy: Math.sin(a + t) * 24,
        life: 0.16, size: 2,
        colour: this.weapon.isFist ? '#c98f5e' : '#eaf2fa',
        drag: 0.86,
        glow: this.weapon.isFist ? 0 : 12,
        glowColour: 'rgba(180,220,255,ALPHA)',
      });
    }
    return true;
  }

  update(dt, map, solids) {
    if (this.dead) { this.deathT += dt; return; }

    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.slowUntil > 0) {
      this.slowUntil -= dt;
      if (this.slowUntil <= 0) this.slowFactor = 1;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.attackT = Math.max(0, this.attackT - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);

    if (this.frozen) {
      // coast to a stop rather than stopping dead, then just idle
      const f = Math.pow(0.0001, dt);
      this.vx *= f; this.vy *= f;
      moveAgainst(map, solids, this, this.vx * dt, this.vy * dt);
      this.moving = false;
      this.anim += dt * 2.6;
      this.bobT += dt;
      this.knockX = this.knockY = 0;
      for (const g of this.ghosts) g.life -= dt;
      this.ghosts = this.ghosts.filter((g) => g.life > 0);
      return;
    }

    // ---- dash overrides normal movement entirely ----
    if (this.dashT > 0) {
      this.dashT -= dt;
      const k = Math.max(0.25, this.dashT / DASH_TIME);   // eases out
      moveAgainst(map, solids, this,
        this.dashX * DASH_SPEED * k * dt, this.dashY * DASH_SPEED * k * dt);

      this.ghosts.push({ x: this.x, y: this.y, life: 0.22, spr: this.sprite() });
      if (this.ghosts.length > 5) this.ghosts.shift();

      P.spawn({
        x: this.x, y: this.y + 4,
        vx: -this.dashX * 40, vy: -this.dashY * 40,
        life: 0.26, size: 2, colour: '#4a6595', drag: 0.9,
      });

      this.anim += dt * 14;
      for (const g of this.ghosts) g.life -= dt;
      this.ghosts = this.ghosts.filter((g) => g.life > 0);
      return;
    }
    for (const g of this.ghosts) g.life -= dt;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);

    const ax = axis();
    // `speedMul` belongs to the world — book two's flood writes it every frame
    // and the library resets it — so the cheat multiplies on top rather than
    // fighting over the same field.
    const sp = SPEED * (this.speedMul ?? 1) * this.slowFactor * dev.speedMul;
    const target = { x: ax.x * sp, y: ax.y * sp };

    // attacking roots you slightly — commitment makes combat readable
    const control = this.attacking ? 0.35 : 1;

    this.vx += (target.x * control - this.vx) * Math.min(1, ACCEL * dt / SPEED);
    this.vy += (target.y * control - this.vy) * Math.min(1, ACCEL * dt / SPEED);

    if (!ax.x && !ax.y) {
      const f = Math.pow(FRICTION, dt);
      this.vx *= f; this.vy *= f;
    }

    // knockback decays fast
    const kd = Math.pow(0.0005, dt);
    this.knockX *= kd; this.knockY *= kd;

    const dx = (this.vx + this.knockX) * dt;
    const dy = (this.vy + this.knockY) * dt;
    moveAgainst(map, solids, this, dx, dy);

    this.moving = Math.hypot(ax.x, ax.y) > 0.05;

    if (!this.attacking && this.moving) {
      if (Math.abs(ax.x) > Math.abs(ax.y)) {
        this.facing = 'side';
        this.flip = ax.x < 0;
      } else {
        this.facing = ax.y > 0 ? 'down' : 'up';
      }
    }

    // animation clock
    this.anim += dt * (this.moving ? 9 : 2.6);
    this.bobT += dt;

    // footstep dust
    if (this.moving) {
      this.stepT += dt;
      if (this.stepT > 0.28) {
        this.stepT = 0;
        P.burst(this.x, this.y + 6, 2, {
          colour: '#31263f', speed: 16, life: 0.35, size: 1, drag: 0.86,
        });
      }
    } else {
      this.stepT = 0.2;
    }
  }

  sprite() {
    const f = Math.floor(this.anim);
    if (this.facing === 'side') {
      const set = this.flip ? LEFT : A;
      return this.moving ? set.sideWalk[f % 4] : set.sideIdle[f % 2];
    }
    if (this.facing === 'up') return this.moving ? A.upWalk[f % 4] : A.upIdle[f % 2];
    return this.moving ? A.downWalk[f % 4] : A.downIdle[f % 2];
  }

  draw(ctx) {
    if (this.dead) {
      const k = Math.min(1, this.deathT / 0.6);
      const s = this.sprite();
      draw(ctx, silhouette(s, '#4a0f18'), this.x, this.y + k * 4, { alpha: 1 - k });
      return;
    }

    // blink while invulnerable, but never fully disappear
    if (!this.dashing && this.invuln > 0 && Math.floor(this.invuln * 22) % 2 === 0) return;

    const spr = this.sprite();
    const bob = this.moving ? 0 : Math.sin(this.bobT * 2.4) * 0.5;

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 7), 5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const g of this.ghosts) {
      draw(ctx, silhouette(g.spr, '#6d8cc0'), g.x, g.y - 1, { alpha: g.life / 0.22 * 0.45 });
    }

    draw(ctx, spr, this.x, this.y - 1 + bob);

    if (this.hurtFlash > 0) {
      draw(ctx, silhouette(spr, '#ffd9dd'), this.x, this.y - 1 + bob, { alpha: this.hurtFlash * 2.6 });
    }

    if (this.weapon.kind === 'claw') this.drawClawHand(ctx);
    if (this.attacking) this.drawSwing(ctx);
  }

  /**
   * The hand itself, when the claw is what you are holding. Drawn even when you
   * are standing still — a weapon that only exists during its own swing never
   * feels like something you are carrying.
   */
  drawClawHand(ctx) {
    const side = this.flip ? -1 : 1;
    const hx = Math.round(this.x + side * 5);
    const hy = Math.round(this.y + 1);
    const open = this.clawMode === 2;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // three fingers, splayed wider in throw mode so the two read apart at a glance
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * (open ? 0.85 : 0.5) + (side < 0 ? Math.PI : 0);
      ctx.strokeStyle = i === 1 ? '#c8ffd4' : '#26c247';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(a) * (open ? 4 : 3), hy + Math.sin(a) * (open ? 4 : 3));
      ctx.stroke();
    }
    ctx.fillStyle = '#031a08';
    ctx.fillRect(hx - 1, hy - 1, 3, 3);
    ctx.fillStyle = open ? '#5cff7a' : '#26c247';
    ctx.fillRect(hx, hy, 1, 1);
    ctx.restore();

    // a stray bit falling off the claw now and then
    if (Math.random() > 0.94) {
      P.spawn({
        x: hx, y: hy, vx: (Math.random() - 0.5) * 12, vy: 10 + Math.random() * 12,
        life: 0.4, size: 1, colour: Math.random() > 0.5 ? '#26c247' : '#5cff7a',
        drag: 0.95, glow: 5, glowColour: 'rgba(38,194,71,ALPHA)',
      });
    }
  }

  drawSwing(ctx) {
    const k = 1 - this.attackT / (this.weapon.swing ?? 0.2);   // 0 -> 1 over the swing
    const a0 = this.attackAngle - this.weapon.arc / 2;
    const a = a0 + this.weapon.arc * k;
    const r = this.weapon.range * 0.78;
    const kind = this.weapon.isFist ? 'fist' : (this.weapon.kind || 'blade');

    // Every weapon swings through the same arc; what differs is what the arc
    // leaves behind. The look is picked once here rather than branched at every
    // draw call below.
    const LOOK = {
      fist:  { trail: '#c98f5e', edge: '#ffd9a8', size: 2, spark: '#ffb648', glow: 'rgba(255,180,110,ALPHA)' },
      // `melee` is what the swords actually call themselves; `blade` is the
      // fallback name, and both want the same steel.
      melee: { trail: '#dceaff', edge: '#ffffff', size: 3, spark: '#bcd8ff', glow: 'rgba(190,220,255,ALPHA)' },
      blade: { trail: '#dceaff', edge: '#ffffff', size: 3, spark: '#bcd8ff', glow: 'rgba(190,220,255,ALPHA)' },
      claw:  { trail: '#26c247', edge: '#c8ffd4', size: 3, spark: '#5cff7a', glow: 'rgba(38,194,71,ALPHA)' },
      wave:  { trail: '#70dad4', edge: '#d6fffb', size: 3, spark: '#70dad4', glow: 'rgba(112,218,212,ALPHA)' },
      place: { trail: '#a866e0', edge: '#ddb4ff', size: 3, spark: '#c78cff', glow: 'rgba(168,102,224,ALPHA)' },
    }[kind] || { trail: '#dceaff', edge: '#ffffff', size: 3, spark: '#bcd8ff', glow: 'rgba(190,220,255,ALPHA)' };

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // A ribbon swept between the trailing and leading edge, rather than six
    // loose dots. This is what makes a swing read as one motion.
    const steps = 9;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = k - (i / steps) * 0.55;
      if (t < 0) break;
      const aa = a0 + this.weapon.arc * t;
      const rr = r * (1 - (i / steps) * 0.16);
      const px = this.x + Math.cos(aa) * rr;
      const py = this.y - 3 + Math.sin(aa) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = LOOK.trail;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = LOOK.size + 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = LOOK.edge;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // the leading point, brightest
    const lx = this.x + Math.cos(a) * r;
    const ly = this.y - 3 + Math.sin(a) * r;
    ctx.globalAlpha = 1;
    ctx.fillStyle = LOOK.edge;
    ctx.fillRect(Math.round(lx) - 1, Math.round(ly) - 1, LOOK.size, LOOK.size);
    ctx.restore();

    // And a signature per weapon, thrown exactly once per swing. Keyed off a
    // flag rather than off attackT, which changes every frame and would have
    // fired this on all of the first few.
    if (!this.sigThisAttack && k > 0.12) {
      this.sigThisAttack = true;
      this.swingSignature(kind, a, r, LOOK);
    }
  }

  /**
   * The bit that is different per weapon. Fists puff dust, a blade throws a
   * clean spark line, the claw sheds binary, the wave gun breathes mist, and the
   * nest placer drops a violet ring.
   */
  swingSignature(kind, a, r, LOOK) {
    const tx = this.x + Math.cos(a) * r;
    const ty = this.y - 3 + Math.sin(a) * r;

    if (kind === 'fist') {
      P.burst(tx, ty, 5, {
        colour: LOOK.spark, speed: 40, life: 0.22, size: 1, drag: 0.86,
        angle: a, spread: 1.5, grav: 60,
      });
      return;
    }
    if (kind === 'claw') {
      for (let i = 0; i < 6; i++) {
        P.spawn({
          x: tx + (Math.random() - 0.5) * 8, y: ty + (Math.random() - 0.5) * 8,
          vx: Math.cos(a) * 50 + (Math.random() - 0.5) * 40,
          vy: Math.sin(a) * 50 + (Math.random() - 0.5) * 40,
          life: 0.3, size: 1, colour: Math.random() > 0.5 ? LOOK.spark : LOOK.trail,
          drag: 0.9, glow: 7, glowColour: LOOK.glow,
        });
      }
      return;
    }
    if (kind === 'wave') {
      P.burst(tx, ty, 9, {
        colour: LOOK.spark, speed: 55, life: 0.4, size: 2, drag: 0.93,
        angle: a, spread: 1.1, glow: 9, glowColour: LOOK.glow,
      });
      return;
    }
    if (kind === 'place') {
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        P.spawn({
          x: tx + Math.cos(ang) * 5, y: ty + Math.sin(ang) * 4,
          vx: Math.cos(ang) * 34, vy: Math.sin(ang) * 26,
          life: 0.35, size: 2, colour: LOOK.spark, drag: 0.9,
          glow: 9, glowColour: LOOK.glow,
        });
      }
      return;
    }
    // a blade: a tight line of sparks flung off the tip, along the arc
    P.burst(tx, ty, 7, {
      colour: LOOK.spark, speed: 90, life: 0.28, size: 2, drag: 0.88,
      angle: a + Math.PI / 2, spread: 0.7, grav: 120,
      glow: 8, glowColour: LOOK.glow,
    });
  }

  drawLight(ctx) {
    // the reader carries a faint lantern glow — keeps the player readable in fog
    addLight(ctx, this.x, this.y, 72, 'rgba(150,180,255,ALPHA)', 0.5);
    if (this.attacking && !this.weapon.isFist) {
      const k = 1 - this.attackT / (this.weapon.swing ?? 0.2);
      const a = this.attackAngle - this.weapon.arc / 2 + this.weapon.arc * k;
      addLight(ctx, this.x + Math.cos(a) * 16, this.y + Math.sin(a) * 16, 26, 'rgba(190,220,255,ALPHA)', 0.7);
    }
    if (this.hurtFlash > 0) {
      addLight(ctx, this.x, this.y, 40, 'rgba(255,60,70,ALPHA)', this.hurtFlash * 2);
    }
  }
}
