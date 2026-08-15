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
    const sp = SPEED * (this.speedMul ?? 1) * dev.speedMul;
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

    if (this.attacking) this.drawSwing(ctx);
  }

  drawSwing(ctx) {
    const k = 1 - this.attackT / (this.weapon.swing ?? 0.2);   // 0 -> 1 over the swing
    const a0 = this.attackAngle - this.weapon.arc / 2;
    const a = a0 + this.weapon.arc * k;
    const r = this.weapon.range * 0.78;
    const fist = this.weapon.isFist;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // arc smear behind the leading edge
    for (let i = 0; i < 6; i++) {
      const t = k - i * 0.055;
      if (t < 0) continue;
      const aa = a0 + this.weapon.arc * t;
      const alpha = (1 - i / 6) * 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fist ? '#c98f5e' : '#dceaff';
      const px = this.x + Math.cos(aa) * r;
      const py = this.y - 3 + Math.sin(aa) * r;
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, fist ? 2 : 3, fist ? 2 : 3);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
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
