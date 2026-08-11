// Runtime room: owns the tilemap, props, enemies, gate, and ground drops, and
// draws everything in the right order (floor, shadows, sorted entities, lights).

import { TileMap } from './tilemap.js';
import { Prop } from '../entities/props.js';
import { Servant } from '../entities/servant.js';
import { DragonKing } from '../entities/dragonking.js';
import { Gate } from '../entities/gate.js';
import { decode, draw } from '../engine/sprite.js';
import { ITEMS } from '../data/sprites.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { TILE, VW, VH } from '../engine/canvas.js';

const ITEM_SPR = {};
for (const id in ITEMS) ITEM_SPR[id] = decode(ITEMS[id][0], 'item:' + id);

/** An item lying on the floor, waiting to be walked over. */
class Drop {
  constructor(id, x, y, count = 1) {
    this.id = id; this.x = x; this.y = y; this.count = count;
    this.t = Math.random() * 6;
    this.dead = false;
    this.vy = -46;
    this.z = 0;
    this.settled = false;
    this.magnet = 0;
  }

  update(dt, player) {
    this.t += dt;
    if (!this.settled) {
      this.vy += 320 * dt;
      this.z += this.vy * dt;
      if (this.z >= 0) { this.z = 0; this.vy = 0; this.settled = true; }
    }
    const d = Math.hypot(player.x - this.x, player.y - this.y);
    if (d < 26) {
      // drift toward the player before pickup — feels far better than a hard radius
      this.magnet = Math.min(1, this.magnet + dt * 3);
      const a = Math.atan2(player.y - this.y, player.x - this.x);
      const sp = 40 + this.magnet * 130;
      this.x += Math.cos(a) * sp * dt;
      this.y += Math.sin(a) * sp * dt;
    }
    return d < 8;
  }

  draw(ctx) {
    const bob = Math.sin(this.t * 3.2) * 1.4;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(Math.round(this.x), Math.round(this.y + 5), 4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    draw(ctx, ITEM_SPR[this.id], this.x, this.y + this.z - 2 + bob);
  }

  drawLight(ctx) {
    addLight(ctx, this.x, this.y, 22, 'rgba(255,220,140,ALPHA)', 0.45);
  }
}

export class Room {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.map = new TileMap(def.tiles, def.floor);
    this.map.bake();
    this.mood = def.mood || {};

    this.props = (def.props || []).map((p) => new Prop(p.type, p.x, p.y));
    this.gate = def.gate ? new Gate(def.gate) : null;
    this.drops = [];
    this.cleared = false;
    this.enteredT = 0;

    this.enemies = (def.enemies || []).map((e) => {
      if (e.type === 'servant') return new Servant(e.x, e.y, e.tier);
      if (e.type === 'king') return new DragonKing(e.x, e.y);
      return null;
    }).filter(Boolean);

    this.smelter = null;   // set by the game when this room has one
  }

  get hasSmelter() { return this.props.some((p) => p.type === 'smelter'); }
  get boss() { return this.enemies.find((e) => e instanceof DragonKing) || null; }

  /** Everything movement should collide with. */
  solids() {
    const out = this.props.filter((p) => p.solid);
    if (this.gate && this.gate.solid) out.push(this.gate);
    for (const e of this.enemies) if (!e.dead) out.push(e);
    return out;
  }

  addDrop(id, x, y, count = 1) {
    this.drops.push(new Drop(id, x, y, count));
  }

  update(dt, player, game) {
    this.enteredT += dt;

    for (const p of this.props) p.update(dt, this);
    if (this.gate) this.gate.update(dt);

    const solids = this.solids();

    for (const e of this.enemies) {
      e.update(dt, player, this.map, solids);

      // Loot is keyed off a flag rather than a before/after comparison: the
      // player's swing is resolved earlier in the frame than this loop, so a
      // sword kill is already `dead` by the time we get here and a transition
      // check would silently miss it.
      if (e.dead && !e.lootDropped) {
        e.lootDropped = true;
        if (e instanceof Servant) {
          if (e.dropsKey) this.addDrop('key', e.x, e.y);
          const n = 1 + ((Math.random() * 2) | 0);
          for (let i = 0; i < n; i++) {
            this.addDrop('gold_coin', e.x + (Math.random() - 0.5) * 10, e.y + (Math.random() - 0.5) * 10);
          }
        }
        if (e instanceof DragonKing) game?.onBossDefeated?.();
      }
    }

    // pick up drops
    for (const d of this.drops) {
      if (d.dead) continue;
      if (d.update(dt, player)) {
        const left = game.inventory.add(d.id, d.count);
        if (left === 0) {
          d.dead = true;
          sfx.pickup();
          P.burst(d.x, d.y, 6, {
            colour: '#f0cc5a', speed: 40, life: 0.35, size: 1,
            glow: 8, glowColour: 'rgba(240,204,90,ALPHA)',
          });
        } else {
          d.magnet = 0;
          d.x += (Math.random() - 0.5) * 20;
          d.y += (Math.random() - 0.5) * 20;
        }
      }
    }
    this.drops = this.drops.filter((d) => !d.dead);

    if (!this.cleared && this.enemies.length && this.enemies.every((e) => e.dead)) {
      this.cleared = true;
    }
  }

  /**
   * Prop the player is close enough to use. Distance is measured to the prop's
   * box, not its centre — otherwise a large prop like the shelf is harder to
   * use than a small one purely because you can't stand near its middle.
   */
  nearestInteractive(player) {
    let best = null, bestD = Infinity;
    for (const p of this.props) {
      if (!p.interactive) continue;
      const dx = Math.max(0, Math.abs(player.x - p.x) - p.hw);
      const dy = Math.max(0, Math.abs(player.y - p.y) - p.hh);
      const d = Math.hypot(dx, dy);
      if (d < p.reach && d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  draw(ctx) {
    // floor + walls
    ctx.drawImage(this.map.baked, 0, 0);

    // entities sorted by feet so things overlap correctly
    const list = [...this.props, ...this.drops, ...this.enemies.filter((e) => !e.dead || e.deathT < 1.4)];
    if (this.gate) list.push(this.gate);
    list.push(this._player);

    list.sort((a, b) => (a?.y ?? 0) - (b?.y ?? 0));

    for (const e of list) {
      if (!e) continue;
      if (e instanceof Prop) e.draw(ctx, this);
      else if (e instanceof DragonKing) e.draw(ctx, this.map);
      else e.draw(ctx);
    }

    // dead bosses still own live projectiles
    for (const e of this.enemies) {
      if (e instanceof DragonKing && e.dead) e.draw(ctx, this.map);
    }
  }

  drawLights(ctx) {
    for (const p of this.props) p.drawLight(ctx, this);
    for (const d of this.drops) d.drawLight(ctx);
    for (const e of this.enemies) {
      if (e instanceof DragonKing) e.drawLight(ctx, this.map);
      else if (!e.dead || e.deathT < 0.4) e.drawLight(ctx);
    }
    if (this.gate) this.gate.drawLight(ctx);
    this._player?.drawLight?.(ctx);
  }

  /** Exit character under the player's feet, or null. */
  exitUnder(player) {
    const c = this.map.exitAt(player.x, player.y);
    return c === 'E' || c === 'B' ? c : null;
  }
}
