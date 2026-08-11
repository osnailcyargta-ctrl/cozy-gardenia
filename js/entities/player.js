import { decodeSet, flipSet, draw, silhouette } from '../engine/sprite.js';
import { PLAYER } from '../data/sprites.js';
import { axis, isDown } from '../engine/input.js';
import { moveAgainst } from '../world/collision.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { FIST } from '../data/items.js';
import * as cam from '../engine/camera.js';

const A = decodeSet(PLAYER, 'player');
const LEFT = flipSet({ sideIdle: A.sideIdle, sideWalk: A.sideWalk }, 'playerL');

const SPEED = 74;
const ACCEL = 900;
const FRICTION = 0.0001;

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
  }

  get attacking() { return this.attackT > 0; }

  hurt(amount, fromX, fromY) {
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

  startAttack(angle) {
    if (this.cooldown > 0 || this.dead) return false;
    this.attackAngle = angle;
    this.attackT = 0.2;
    this.cooldown = this.weapon.cooldown;
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

    const ax = axis();
    const target = { x: ax.x * SPEED, y: ax.y * SPEED };

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
    if (this.invuln > 0 && Math.floor(this.invuln * 22) % 2 === 0) return;

    const spr = this.sprite();
    const bob = this.moving ? 0 : Math.sin(this.bobT * 2.4) * 0.5;

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 7), 5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    draw(ctx, spr, this.x, this.y - 1 + bob);

    if (this.hurtFlash > 0) {
      draw(ctx, silhouette(spr, '#ffd9dd'), this.x, this.y - 1 + bob, { alpha: this.hurtFlash * 2.6 });
    }

    if (this.attacking) this.drawSwing(ctx);
  }

  drawSwing(ctx) {
    const k = 1 - this.attackT / 0.2;             // 0 -> 1 over the swing
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
      const k = 1 - this.attackT / 0.2;
      const a = this.attackAngle - this.weapon.arc / 2 + this.weapon.arc * k;
      addLight(ctx, this.x + Math.cos(a) * 16, this.y + Math.sin(a) * 16, 26, 'rgba(190,220,255,ALPHA)', 0.7);
    }
    if (this.hurtFlash > 0) {
      addLight(ctx, this.x, this.y, 40, 'rgba(255,60,70,ALPHA)', this.hurtFlash * 2);
    }
  }
}
