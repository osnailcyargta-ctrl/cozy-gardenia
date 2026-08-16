// Runtime room: owns the tilemap, props, enemies, gate, and ground drops, and
// draws everything in the right order (floor, shadows, sorted entities, lights).

import { TileMap } from './tilemap.js';
import { Prop } from '../entities/props.js';
import { Servant, StrayServant } from '../entities/servant.js';
import { DragonKing } from '../entities/dragonking.js';
import { Thrall, Siren } from '../entities/drowned.js';
import { DrownedQueen } from '../entities/drownedqueen.js';
import { Crawler } from '../entities/crawler.js';
import { Nullbyte } from '../entities/nullbyte.js';
import { Kernel } from '../entities/kernel.js';
import { Nest } from '../entities/blackhole.js';
import { Gate } from '../entities/gate.js';
import { decode, draw } from '../engine/sprite.js';
import { ITEMS, NEST } from '../data/sprites.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { TILE, VW, VH } from '../engine/canvas.js';

const ITEM_SPR = {};
for (const id in ITEMS) ITEM_SPR[id] = decode(ITEMS[id][0], 'item:' + id);

const NEST_SPR = decode(NEST.block[0], 'nestBlock');

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

/** A placed nest, with a ring showing how close the next hole is. */
function drawNest(ctx, n) {
  const spr = NEST_SPR;
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(Math.round(n.x), Math.round(n.y + 6), 7, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  draw(ctx, spr, n.x, n.y + Math.sin(n.t * 2.4) * 1.2);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(221,180,255,${0.35 + n.pulse * 0.5})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(n.x, n.y, 11, -Math.PI / 2, -Math.PI / 2 + n.charge * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Everything that can be a monster, in one place. The debug menu's spawn list
 * builds from the same table the rooms do, so there is no second roster to keep
 * in step with this one.
 */
export const ENEMY_KINDS = {
  servant1: (x, y, m) => new Servant(x, y, 1, m),
  servant2: (x, y, m) => new Servant(x, y, 2, m),
  thrall:   (x, y, m) => new Thrall(x, y, m),
  siren1:   (x, y, m) => new Siren(x, y, 1, m),
  siren2:   (x, y, m) => new Siren(x, y, 2, m),
  crawler:  (x, y, m, def) => new Crawler(x, y, m, def?.dropsCoin === undefined ? null : def),
  stray1:   (x, y, m) => new StrayServant(x, y, 1, m),
  stray2:   (x, y, m) => new StrayServant(x, y, 2, m),
  nullbyte: (x, y, m) => new Nullbyte(x, y, m),
  king:     (x, y) => new DragonKing(x, y),
  kernel:   (x, y) => new Kernel(x, y),
  queen:    (x, y) => new DrownedQueen(x, y),
};

/** Names for the debug menu, in the order it should list them. */
export const ENEMY_NAMES = {
  crawler: 'Zombie Crawler',
  servant1: "Dragon's Servant I", servant2: "Dragon's Servant II",
  stray1: 'Stray Servant I', stray2: 'Stray Servant II',
  thrall: 'Drowned Thrall', siren1: 'Siren I', siren2: 'Siren II',
  nullbyte: 'Nullbyte',
  king: 'Dragon King', queen: 'Drowned Queen', kernel: 'The Kernel',
};

export function makeEnemy(type, x, y, statMul = 1, def = null) {
  return ENEMY_KINDS[type]?.(x, y, statMul, def) || null;
}

export class Room {
  /**
   * `deadSet` holds the indices — into `def.enemies`, not into the live list —
   * of things already killed on a previous visit. They are skipped rather than
   * built and marked dead: no corpse to draw, nothing to update, and the index
   * stays meaningful because it points at the definition rather than at whoever
   * happens to be standing.
   */
  constructor(def, deadSet = new Set()) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.map = new TileMap(def.tiles, def.floor);
    this.map.bake();
    this.mood = def.mood || {};
    this.dungeon = !!def.dungeon;

    this.props = (def.props || []).map((p) => new Prop(p.type, p.x, p.y, p));
    this.gate = def.gate ? new Gate(def.gate) : null;
    this.drops = [];
    this.waves = [];
    this.nests = [];      // placed blackholian nests
    this.holes = [];      // and what they throw
    this.claw = null;     // the one thrown hand, if there is one
    this.portal = null;   // and the one doorway, if there is one
    this.chain = null;    // and the one chain, while it is swinging
    this.cleared = false;
    this.enteredT = 0;
    // Set the first time you walk in. Somewhere new is worth three hearts;
    // walking back through a door you already came through is not.
    this.visited = false;
    this.keyDropped = false;

    this.deadFromSave = new Set(deadSet);
    this.enemies = (def.enemies || []).map((e, i) => {
      if (deadSet.has(i)) return null;
      const m = e.statMul || 1;
      // the two that name their tier in the def rather than in the type
      const made = e.type === 'servant' ? new Servant(e.x, e.y, e.tier, m)
        : e.type === 'siren' ? new Siren(e.x, e.y, e.tier, m)
        : makeEnemy(e.type, e.x, e.y, m, e);
      if (made) {
        made.defIndex = i;
        if (e.keyId !== undefined) made.keyId = e.keyId;
        // Bosses ignore statMul in their constructors — they are hand-tuned —
        // so the dungeon's curve is applied to them here instead.
        if (made.isBoss && m !== 1) {
          made.maxHp = Math.round(made.maxHp * m);
          made.hp = made.maxHp;
          made.dmgMul = m;
        }
      }
      return made;
    }).filter(Boolean);

    this.smelter = null;   // set by the game when this room has one
  }

  /**
   * Hard mode, applied to everything standing in the room. Damage and health
   * move by different amounts on purpose: 1.5x damage is what you feel, 1.25x
   * health is what stops the fight being the same length with bigger numbers.
   */
  applyHard() {
    for (const e of this.enemies) {
      e.maxHp = Math.round(e.maxHp * 1.25);
      e.hp = e.maxHp;
      // `damage` is not a field every enemy has — servants and sirens keep
      // theirs in a cfg table and the bosses hard-code theirs at the call site.
      // dmgMul is the one thing they all read, so it is the one thing set here.
      if (typeof e.damage === 'number') e.damage = Math.round(e.damage * 1.5);
      e.dmgMul = (e.dmgMul ?? 1) * 1.5;
    }
  }

  get hasSmelter() { return this.props.some((p) => p.type === 'smelter'); }

  /** Bosses declare themselves, so a new book doesn't need a new branch here. */
  get boss() { return this.enemies.find((e) => e.isBoss) || null; }

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

  /** Plant a wave-gun cone. Lives in the room, not on the player. */
  addWave(wave) { this.waves.push(wave); }

  /**
   * Put down a nest. It belongs to the room, so when book four throws the room
   * away the nest and everything it spawned go with it — which is exactly the
   * rule that "black holes do not travel between rooms" asks for.
   */
  addNest(x, y) { this.nests.push(new Nest(x, y)); }

  /**
   * Copy over the parts of a previous instance of this same room that a death
   * should not undo: chests you already emptied stay empty, so respawning in
   * front of the wave-gun chest can't mint a second wave gun.
   */
  inheritContainers(old) {
    if (!old) return;
    const mine = this.props.filter((p) => p.container);
    const theirs = old.props.filter((p) => p.container);
    mine.forEach((p, i) => { if (theirs[i]) p.container.load(theirs[i].container.serialize()); });
  }

  /**
   * Every live projectile in the room that a swing could connect with. Only the
   * boss fires anything today, but going through the room keeps main.js from
   * reaching into `room.boss.projectiles` directly.
   */
  projectiles() {
    const out = [];
    for (const e of this.enemies) {
      if (!e.projectiles) continue;
      for (const pr of e.projectiles) if (!pr.dead && pr.breakable) out.push(pr);
    }
    return out;
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
        if (e instanceof Crawler && e.dropsCoin) {
          for (let i = 0; i < e.coinCount; i++) {
            this.addDrop('gold_coin', e.x + (Math.random() - 0.5) * 12, e.y + (Math.random() - 0.5) * 12);
          }
        }
        // Book two's drowned leave no coin. The queen is not a hoarder, so
        // nothing under her rule is worth carrying out except the key.
        if (e instanceof Servant) this.scatterCoins(e, 'gold_coin');
        // One in fifty nullbytes is carrying the thing that made them.
        if (e instanceof Nullbyte && Math.random() < 0.02) {
          this.addDrop('digital_claw_cannon', e.x, e.y);
        }
        // And one in a hundred of anything at all, down in the dungeon.
        if (this.dungeon && Math.random() < 0.01) {
          this.addDrop('chain_hook', e.x, e.y);
        }
        if (e.keyId) this.addDrop(e.keyId, e.x, e.y);

        // Book four locks the way on instead of on a particular monster: the
        // last thing standing is carrying the key, whoever it turns out to be.
        //
        // The latch matters. This loop runs over every corpse in the frame, and
        // anything that kills several at once — a wave-gun tick, a black hole,
        // the last two walking into a swing together — leaves them all holding
        // "everything is dead" at the same moment. Without it, one room could
        // hand over twenty-five keys.
        if (this.def.keyOnLastKill && !this.keyDropped && this.enemies.every((x) => x.dead)) {
          this.keyDropped = true;
          this.addDrop(this.def.keyOnLastKill, e.x, e.y);
        }
      }

      // A boss counts as beaten when its collapse has finished playing, not
      // when its health hits zero — otherwise the book closes and the music
      // changes in the middle of the death animation.
      if (e.isBoss && e.defeatDone && !e.defeatReported) {
        e.defeatReported = true;
        game?.onBossDefeated?.();
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

    for (const w of this.waves) w.update(dt, this.enemies);
    this.waves = this.waves.filter((w) => !w.dead);

    if (this.claw) {
      this.claw.update(dt, this.enemies, this.map, solids);
      if (this.claw.dead) this.claw = null;
    }

    for (const n of this.nests) {
      const hole = n.update(dt);
      if (hole) this.holes.push(hole);
    }
    for (const h of this.holes) h.update(dt, this.enemies);
    this.holes = this.holes.filter((h) => !h.dead);

    if (!this.cleared && this.enemies.length && this.enemies.every((e) => e.dead)) {
      this.cleared = true;
    }
  }

  scatterCoins(e, id) {
    const n = 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      this.addDrop(id, e.x + (Math.random() - 0.5) * 10, e.y + (Math.random() - 0.5) * 10);
    }
  }

  /**
   * Prop the player is close enough to use. Distance is measured to the prop's
   * box, not its centre — otherwise a large prop like the shelf is harder to
   * use than a small one purely because you can't stand near its middle.
   */
  /** Props plus, in book three, the errored gate — it is talked to, not hit. */
  interactives() {
    const out = this.props.filter((p) => p.interactive);
    if (this.gate?.interactive) out.push(this.gate);
    return out;
  }

  nearestInteractive(player) {
    let best = null, bestD = Infinity;
    for (const p of this.interactives()) {
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
    const list = [...this.props, ...this.drops, ...this.nests,
      ...this.enemies.filter((e) => !e.dead || e.deathT < 1.4)];
    if (this.gate) list.push(this.gate);
    list.push(this._player);

    list.sort((a, b) => (a?.y ?? 0) - (b?.y ?? 0));

    for (const e of list) {
      if (!e) continue;
      if (e instanceof Prop) e.draw(ctx, this);
      else if (e instanceof Nest) drawNest(ctx, e);
      else if (e.isBoss) e.draw(ctx, this.map);
      else e.draw(ctx);
    }

    // dead bosses still own live projectiles
    for (const e of this.enemies) {
      if (e.isBoss && e.dead) e.draw(ctx, this.map);
    }

    // waves sit on top of everything they are drowning
    for (const w of this.waves) w.draw(ctx);
    this.claw?.draw(ctx);
    this.portal?.draw(ctx);
    this.chain?.draw(ctx);
    for (const h of this.holes) h.draw(ctx);
  }

  drawLights(ctx) {
    for (const p of this.props) p.drawLight(ctx, this);
    for (const d of this.drops) d.drawLight(ctx);
    for (const e of this.enemies) {
      if (e.isBoss) e.drawLight(ctx, this.map);
      else if (!e.dead || e.deathT < 0.4) e.drawLight(ctx);
    }
    for (const w of this.waves) w.drawLight(ctx);
    this.claw?.drawLight(ctx);
    this.portal?.drawLight(ctx);
    this.chain?.drawLight(ctx);
    for (const n of this.nests) addLight(ctx, n.x, n.y, 40 + n.charge * 26, 'rgba(168,102,224,ALPHA)', 0.4 + n.pulse * 0.5);
    // last, so the holes can eat the light everything else just added
    for (const h of this.holes) h.drawLight(ctx);
    if (this.gate) this.gate.drawLight(ctx);
    this._player?.drawLight?.(ctx);
  }

  /** Exit character under the player's feet, or null. */
  exitUnder(player) {
    const c = this.map.exitAt(player.x, player.y);
    return c === 'E' || c === 'B' ? c : null;
  }
}
