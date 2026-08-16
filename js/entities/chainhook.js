// The Chain Hook.
//
// Hold left click and the chain whirls around you at two tiles — a flail. Keep
// holding past two seconds and it launches at the cursor with no range limit.
// If it catches something it drags it back to your feet for 10; keep holding
// and you spin the thing you caught for a second, then let go and it flies at
// the cursor for 20 more when it lands on a wall or on something else.
//
// The whole attack is one state machine on one object, because every step of it
// depends on where the last one ended: it is the only weapon in the game where
// letting go early is a decision rather than a mistake.

import { addLight } from '../engine/postfx.js';
import { TILE } from '../engine/canvas.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as cam from '../engine/camera.js';

export const SPIN_RANGE = TILE * 2;      // phase one reaches two tiles
export const CHARGE_TIME = 2;            // hold this long and it launches
export const WHIRL_TIME = 1;             // how long a caught thing is spun
export const GRAB_DAMAGE = 10;           // the catch
export const SLAM_DAMAGE = 20;           // the landing
const FLY_SPEED = 380;
const REEL_SPEED = 460;
const HURL_SPEED = 420;

export const SPIN = 'spin', FLY = 'fly', REEL = 'reel', WHIRL = 'whirl',
  HURL = 'hurl', DONE = 'done';

export class ChainHook {
  constructor(player) {
    this.player = player;
    this.state = SPIN;
    this.t = 0;
    this.angle = 0;          // where the head is, around the player
    this.spin = 7.5;         // radians a second while whirling
    this.x = player.x;
    this.y = player.y;
    this.caught = null;      // the enemy on the end of it
    this.dead = false;
    this.hitThisSpin = new Set();
    sfx.swing();
  }

  /** Where the head sits when it is circling something. */
  orbit(cx, cy, r) {
    this.x = cx + Math.cos(this.angle) * r;
    this.y = cy + Math.sin(this.angle) * r;
  }

  cancel() {
    this.state = DONE;
    this.dead = true;
  }

  update(dt, ctx) {
    const { player, enemies, map, aimX, aimY, held } = ctx;
    this.t += dt;

    switch (this.state) {
      /* ---- phase one: a flail, two tiles out ---- */
      case SPIN: {
        this.angle += this.spin * dt;
        this.orbit(player.x, player.y, SPIN_RANGE);
        for (const e of enemies) {
          if (e.dead || this.hitThisSpin.has(e)) continue;
          if (Math.hypot(e.x - this.x, e.y - this.y) < (e.radius || 8) + 6) {
            this.hitThisSpin.add(e);
            e.hurt(GRAB_DAMAGE, player.x, player.y);
          }
        }
        // the spin only clears its memory each full turn, so one enemy standing
        // in the arc takes one hit per pass rather than one per frame
        if (this.angle > Math.PI * 2) { this.angle -= Math.PI * 2; this.hitThisSpin.clear(); }

        if (this.t >= CHARGE_TIME) {
          this.state = FLY;
          this.t = 0;
          this.dir = Math.atan2(aimY - player.y, aimX - player.x);
          // Launch along the line from the player to the cursor, not from
          // wherever the orbit happened to stop. Continuing from the orbit means
          // the throw is offset by up to two tiles perpendicular to where you
          // are pointing, which reads as the weapon simply missing.
          this.x = player.x + Math.cos(this.dir) * 10;
          this.y = player.y + Math.sin(this.dir) * 10;
          sfx.dash();
          cam.shake(3, 0.2);
        } else if (!held) {
          // let go early and it is just a flail; nothing is thrown
          this.cancel();
        }
        break;
      }

      /* ---- phase two: out, as far as it takes ---- */
      case FLY: {
        this.x += Math.cos(this.dir) * FLY_SPEED * dt;
        this.y += Math.sin(this.dir) * FLY_SPEED * dt;

        for (const e of enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - this.x, e.y - this.y) < (e.radius || 8) + 6) {
            this.caught = e;
            e.hurt(GRAB_DAMAGE, player.x, player.y);
            this.state = REEL;
            this.t = 0;
            sfx.hit();
            cam.shake(3, 0.18);
            return;
          }
        }
        // a wall ends it — that is the cost of missing
        if (map.solidPx(this.x, this.y)) {
          P.burst(this.x, this.y, 10, {
            colour: '#b6c8d8', speed: 90, life: 0.3, size: 2, drag: 0.9,
          });
          sfx.hitWood();
          this.cancel();
        }
        if (this.t > 2.5) this.cancel();
        break;
      }

      /* ---- drag it home ---- */
      case REEL: {
        const e = this.caught;
        if (!e || e.dead) { this.cancel(); return; }
        const a = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(a) * REEL_SPEED * dt;
        e.y += Math.sin(a) * REEL_SPEED * dt;
        this.x = e.x; this.y = e.y;
        if (Math.hypot(player.x - e.x, player.y - e.y) < 26) {
          if (held) {
            this.state = WHIRL;
            this.t = 0;
            this.angle = Math.atan2(e.y - player.y, e.x - player.x);
          } else {
            this.cancel();
          }
        }
        break;
      }

      /* ---- spin what you caught ---- */
      case WHIRL: {
        const e = this.caught;
        if (!e || e.dead) { this.cancel(); return; }
        this.angle += this.spin * 1.6 * dt;
        const r = 24;
        e.x = player.x + Math.cos(this.angle) * r;
        e.y = player.y + Math.sin(this.angle) * r;
        this.x = e.x; this.y = e.y;
        if (Math.random() > 0.5) {
          P.spawn({
            x: e.x, y: e.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
            life: 0.25, size: 1, colour: '#b6c8d8', drag: 0.9,
          });
        }
        // a second of it, or the moment the button comes up
        if (this.t >= WHIRL_TIME || !held) {
          this.state = HURL;
          this.t = 0;
          this.dir = Math.atan2(aimY - player.y, aimX - player.x);
          sfx.swing();
          cam.shake(4, 0.25);
        }
        break;
      }

      /* ---- and let go ---- */
      case HURL: {
        const e = this.caught;
        if (!e || e.dead) { this.cancel(); return; }
        const step = HURL_SPEED * dt;
        e.x += Math.cos(this.dir) * step;
        e.y += Math.sin(this.dir) * step;
        this.x = e.x; this.y = e.y;

        // the landing: a wall, or somebody else
        let landed = map.solidPx(e.x, e.y);
        let struck = null;
        if (!landed) {
          for (const o of enemies) {
            if (o === e || o.dead) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) < (o.radius || 8) + (e.radius || 8)) {
              struck = o; landed = true; break;
            }
          }
        }

        if (landed) {
          e.hurt(SLAM_DAMAGE, player.x, player.y, 2);
          struck?.hurt(SLAM_DAMAGE, e.x, e.y, 2);
          // knocked away from where it came from, hard
          e.knockX = Math.cos(this.dir) * 220;
          e.knockY = Math.sin(this.dir) * 220;
          sfx.break();
          cam.shake(6, 0.35);
          P.burst(e.x, e.y, 16, {
            colour: '#dceaff', speed: 130, life: 0.4, size: 2, drag: 0.88,
            glow: 10, glowColour: 'rgba(190,220,255,ALPHA)',
          });
          this.cancel();
        }
        if (this.t > 2) this.cancel();
        break;
      }
    }
  }

  draw(ctx) {
    const p = this.player;
    const x = Math.round(this.x), y = Math.round(this.y);

    // the chain: links drawn along the line rather than a stroke, so it reads
    // as a chain at this scale instead of a wire
    const dx = x - p.x, dy = y - p.y;
    const len = Math.hypot(dx, dy);
    const links = Math.max(1, Math.round(len / 5));
    for (let i = 1; i < links; i++) {
      const t = i / links;
      const lx = Math.round(p.x + dx * t);
      const ly = Math.round(p.y + dy * t - 3);
      ctx.fillStyle = i % 2 ? '#7d92a6' : '#4e5f72';
      ctx.fillRect(lx - 1, ly - 1, 2, 2);
    }

    // the head
    ctx.save();
    ctx.translate(x, y - 3);
    ctx.rotate(this.angle * 1.5);
    ctx.fillStyle = '#2b3440';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#b6c8d8';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.fillStyle = '#eaf2fa';
    ctx.fillRect(-1, -3, 2, 2);
    // barbs
    ctx.fillStyle = '#7d92a6';
    ctx.fillRect(-6, -1, 2, 2);
    ctx.fillRect(4, -1, 2, 2);
    ctx.restore();

    // while it is charging, show how close the launch is
    if (this.state === SPIN) {
      const k = Math.min(1, this.t / CHARGE_TIME);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = k >= 1 ? 'rgba(255,242,176,0.9)' : `rgba(182,200,216,${0.25 + k * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, SPIN_RANGE, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawLight(ctx) {
    addLight(ctx, this.x, this.y, 22, 'rgba(190,220,255,ALPHA)', 0.4);
  }
}
