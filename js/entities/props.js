// Static room furniture. Interactive props expose `interact` and a prompt label;
// decorative ones just draw and emit light.

import { decode, draw } from '../engine/sprite.js';
import { BLOCKS, MERCHANT, NEST } from '../data/sprites.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';
import { Container } from '../systems/inventory.js';

const S = {
  smelter: decode(BLOCKS.smelter[0], 'smelter'),
  smelterHot: decode(BLOCKS.smelterHot[0], 'smelterHot'),
  chest: decode(BLOCKS.chest[0], 'chest'),
  chestOpen: decode(BLOCKS.chestOpen[0], 'chestOpen'),
  anvil: decode(BLOCKS.anvil[0], 'anvil'),
  shelf: decode(BLOCKS.shelf[0], 'shelf'),
  torch0: decode(BLOCKS.torch[0], 'torch0'),
  torch1: decode(BLOCKS.torch[1], 'torch1'),
  coinPile: decode(BLOCKS.coinPile[0], 'coinPile'),
  coral: decode(BLOCKS.coral[0], 'coral'),
  kelp0: decode(BLOCKS.kelp[0], 'kelp0'),
  kelp1: decode(BLOCKS.kelp[1], 'kelp1'),
  merchant0: decode(MERCHANT.idle[0], 'merchant0'),
  merchant1: decode(MERCHANT.idle[1], 'merchant1'),
  nest: decode(NEST.block[0], 'nestBlock'),
  nullbyteNest: decode(BLOCKS.nullbyteNest[0], 'nullbyteNest'),
};

export class Prop {
  constructor(type, x, y, def = {}) {
    this.type = type;
    this.x = x; this.y = y;
    this.t = Math.random() * 10;
    this.dead = false;
    this.opened = false;

    const box = {
      smelter:   [8, 8,  true,  'Smelter'],
      chest:     [8, 6,  true,  'Chest'],
      anvil:     [8, 6,  true,  'Anvil'],
      shelf:     [30, 22, true, 'Shelf'],
      torch:     [0, 0,  false, null],
      coinPile:  [8, 4,  true,  null],
      coral:     [7, 6,  true,  null],
      // kelp is scenery you walk straight through — a reef that blocks
      // movement turns the room into a maze nobody asked for
      kelp:      [0, 0,  false, null],
      merchant:  [7, 7,  true,  'Merchant'],
      // two tiles by two, so its box is a full 16 either way
      nullbyteNest: [16, 16, true, 'Nullbyte Nest'],
      // A hole punched through the floor. Solid like a chest or an anvil — you
      // walk around it, never through it — and nothing to interact with.
      void:      [7, 7,  true,  null],
      // The portal is walked into, not walked around — it is the only way out
      // of the dungeon and it must never be something you can get stuck behind.
      portal:    [0, 0,  false, 'Portal'],
    }[type] || [8, 8, true, null];

    this.hw = box[0];
    this.hh = box[1];
    this.solid = box[2];
    this.label = box[3];
    this.interactive = !!this.label;

    // The shelf is the library's one hero object; at 1x it reads as a trinket
    // lost in the room rather than the thing the whole hub is built around.
    this.scale = type === 'shelf' ? 2 : 1;

    // The merchant's stall is stocked from a seed the room generator hands
    // down, and remembers which rows are already bought out.
    if (def.seed) this.seed = def.seed;
    if (def.soldRows) this.soldRows = def.soldRows;

    // Every chest owns its contents. One shared container across the whole game
    // meant book two's wave-gun chest and book one's ore chest were the same
    // box wearing two hats.
    if (type === 'chest') {
      this.title = def.title || 'Chest';
      this.container = new Container(9, this.title);
      for (const [slot, entry] of Object.entries(def.contents || {})) {
        this.container.slots[Number(slot)] = { id: entry.id, count: entry.count ?? 1 };
      }
    }

    // Interaction reach, measured to the prop's box. Generous on purpose: with
    // no on-screen prompt telling you when you are in range, a tight radius
    // reads as "E is broken" rather than "stand closer".
    this.reach = type === 'shelf' ? 34 : (type === 'portal' ? 30 : 26);

    // A nest holds four summons and a ten second wait between them. Both are
    // drawn on the block itself, so you never have to guess what is left.
    if (type === 'nullbyteNest') {
      this.charges = 4;
      this.cool = 0;
    }

    // The void corrupts anything standing in the 3x3 of tiles around it, once
    // every 1.5s. Its own clock, so two voids never share a timer.
    if (type === 'void') {
      this.bite = 0;
      this.digits = [];
      this.seed = Math.random() * 100;
    }
  }

  update(dt, room) {
    this.t += dt;

    if (this.type === 'torch') {
      // embers drifting up off the flame
      if (Math.random() > 0.86) {
        P.spawn({
          x: this.x + (Math.random() - 0.5) * 3,
          y: this.y - 5,
          vx: (Math.random() - 0.5) * 10,
          vy: -14 - Math.random() * 12,
          life: 0.7 + Math.random() * 0.5,
          size: 1,
          colour: Math.random() > 0.4 ? '#ffb648' : '#e87a2c',
          drag: 0.97,
          glow: 6,
          glowColour: 'rgba(255,160,60,ALPHA)',
        });
      }
    }

    if ((this.type === 'coral' || this.type === 'kelp') && Math.random() > 0.965) {
      P.spawn({
        x: this.x + (Math.random() - 0.5) * 10,
        y: this.y + 2,
        vx: (Math.random() - 0.5) * 5,
        vy: -14 - Math.random() * 10,
        life: 1 + Math.random() * 0.8,
        size: 1,
        colour: '#70dad4',
        drag: 0.99,
        glow: 5,
        glowColour: 'rgba(110,220,215,ALPHA)',
      });
    }

    if (this.type === 'portal') {
      // motes falling inward, so the way out reads as a way through
      if (Math.random() > 0.5) {
        const a = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 16;
        P.spawn({
          x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r * 0.6,
          vx: -Math.cos(a) * 44, vy: -Math.sin(a) * 30,
          life: 0.5, size: 2, colour: Math.random() > 0.5 ? '#a866e0' : '#ddb4ff',
          drag: 0.95, glow: 10, glowColour: 'rgba(168,102,224,ALPHA)',
        });
      }
    }

    if (this.type === 'merchant' && Math.random() > 0.94) {
      P.spawn({
        x: this.x - 6, y: this.y + 1,
        vx: 0, vy: -10 - Math.random() * 8,
        life: 0.8, size: 1, colour: '#f0cc5a', drag: 0.97,
        glow: 6, glowColour: 'rgba(240,204,90,ALPHA)',
      });
    }

    if (this.type === 'void') {
      this.bite = Math.max(0, this.bite - dt);
      // a column of ones and zeroes rising out of the hole
      if (Math.random() > 0.72) {
        this.digits.push({
          x: (Math.random() - 0.5) * 13,
          y: 4,
          ch: Math.random() > 0.5 ? '1' : '0',
          life: 0.9 + Math.random() * 0.7,
          sp: 16 + Math.random() * 16,
        });
      }
      for (const d of this.digits) { d.y -= d.sp * dt; d.life -= dt; }
      this.digits = this.digits.filter((d) => d.life > 0);
    }

    if (this.type === 'nullbyteNest') {
      this.cool = Math.max(0, this.cool - dt);
      if (this.charges > 0 && Math.random() > 0.9) {
        P.spawn({
          x: this.x + (Math.random() - 0.5) * 26, y: this.y + 12,
          vx: 0, vy: -12 - Math.random() * 10,
          life: 0.7, size: 1, colour: Math.random() > 0.5 ? '#26c247' : '#5cff7a',
          drag: 0.97, glow: 6, glowColour: 'rgba(38,194,71,ALPHA)',
        });
      }
    }

    if (this.type === 'smelter' && room?.smelter?.burning) {
      if (Math.random() > 0.7) {
        P.spawn({
          x: this.x + (Math.random() - 0.5) * 8,
          y: this.y - 6,
          vx: (Math.random() - 0.5) * 14,
          vy: -18 - Math.random() * 14,
          life: 0.6, size: 1,
          colour: '#ffb648', drag: 0.96,
          glow: 7, glowColour: 'rgba(255,150,50,ALPHA)',
        });
      }
    }
  }

  sprite(room) {
    switch (this.type) {
      case 'smelter': return room?.smelter?.burning ? S.smelterHot : S.smelter;
      case 'chest':   return this.opened ? S.chestOpen : S.chest;
      case 'anvil':   return S.anvil;
      case 'shelf':   return S.shelf;
      case 'coinPile': return S.coinPile;
      case 'coral':   return S.coral;
      case 'kelp':    return Math.floor(this.t * 1.6) % 2 ? S.kelp1 : S.kelp0;
      case 'torch':   return Math.floor(this.t * 6.5) % 2 ? S.torch1 : S.torch0;
      case 'merchant': return Math.floor(this.t * 1.4) % 2 ? S.merchant1 : S.merchant0;
      case 'nest':    return S.nest;
      case 'nullbyteNest': return S.nullbyteNest;
    }
    return S.anvil;
  }

  draw(ctx, room) {
    if (this.type === 'portal') { this.drawPortal(ctx); return; }
    if (this.type === 'void') { this.drawVoid(ctx); return; }

    const spr = this.sprite(room);

    if (this.type !== 'torch' && this.type !== 'kelp') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(Math.round(this.x), Math.round(this.y + this.hh - 1),
        this.hw * 0.85, 2.6 * this.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    draw(ctx, spr, this.x, this.y, { scale: this.scale });

    // four charge lights across the top of the nest, and the recharge ring
    if (this.type === 'nullbyteNest') {
      const x0 = Math.round(this.x) - 12, y0 = Math.round(this.y) - 20;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i < this.charges ? '#5cff7a' : '#0a3d17';
        ctx.fillRect(x0 + i * 7, y0, 5, 3);
      }
      if (this.cool > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(38,194,71,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 19, -Math.PI / 2,
          -Math.PI / 2 + (1 - this.cool / 10) * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // gold glints on the coin piles
    if (this.type === 'coinPile') {
      const g = (this.t * 1.7) % 3;
      if (g < 0.3) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - g / 0.3;
        ctx.fillStyle = '#fff2b0';
        const gx = Math.round(this.x - 5 + ((this.t * 37) % 11));
        const gy = Math.round(this.y - 2 + ((this.t * 53) % 7));
        ctx.fillRect(gx, gy, 1, 1);
        ctx.fillRect(gx - 1, gy, 3, 1);
        ctx.fillRect(gx, gy - 1, 1, 3);
        ctx.restore();
      }
    }
  }

  /**
   * The way home. Drawn rather than spritetd: a ring of turning light reads as
   * a hole in the world in a way a 16x16 tile of purple never would.
   */
  /**
   * A piece of the book that has stopped rendering: flat black with a torn,
   * flickering rim, and binary climbing out of it. Drawn rather than decoded
   * because a hole is an absence — there is no art to put in it.
   */
  drawVoid(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);

    // the digits climb out from behind the hole
    ctx.save();
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    for (const d of this.digits) {
      ctx.fillStyle = `rgba(38,194,71,${Math.min(1, d.life) * 0.8})`;
      ctx.fillText(d.ch, x + d.x, y + d.y);
    }
    ctx.restore();

    // the hole itself — true black, no shading, so it reads as missing
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // a torn rim that glitches: a handful of short bars around the edge
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + this.t * 0.6;
      const r = 7 + Math.sin(this.t * 7 + i * 2 + this.seed) * 1.6;
      const bright = (i + ((this.t * 6) | 0)) % 4 === 0;
      ctx.fillStyle = bright ? 'rgba(200,255,212,0.85)' : 'rgba(18,122,44,0.6)';
      ctx.fillRect(Math.round(x + Math.cos(a) * r) - 1, Math.round(y + Math.sin(a) * r * 0.9), 2, 1);
    }
    ctx.restore();
  }

  drawPortal(ctx) {
    const t = this.t;
    const x = this.x, y = this.y;

    // A hole in the floor first, drawn flat and dark. Without it the rings had
    // nothing to sit against and the whole thing read as a hoop lying about on
    // the ground rather than somewhere you could fall through.
    ctx.save();
    const pit = ctx.createRadialGradient(x, y, 1, x, y, 18);
    pit.addColorStop(0, 'rgba(6,3,14,0.92)');
    pit.addColorStop(0.62, 'rgba(14,7,28,0.72)');
    pit.addColorStop(1, 'rgba(20,10,38,0)');
    ctx.fillStyle = pit;
    ctx.beginPath();
    ctx.ellipse(x, y, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // the mouth
    // Kept well under white: bloom runs after this, and a full-strength core
    // came back as a featureless blob with the rings burned out of it.
    const g = ctx.createRadialGradient(x, y, 1, x, y, 20);
    g.addColorStop(0, 'rgba(186,150,235,0.55)');
    g.addColorStop(0.45, 'rgba(120,66,190,0.34)');
    g.addColorStop(1, 'rgba(60,30,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // three rings, each turning at its own rate
    for (let i = 0; i < 3; i++) {
      const spin = t * (0.9 + i * 0.5) + i * 1.1;
      const rx = 9 + i * 4.5 + Math.sin(t * 2 + i) * 0.8;
      ctx.strokeStyle = `rgba(${[221, 190, 150][i]},${[180, 130, 90][i]},255,${0.75 - i * 0.18})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * 0.42, spin, 0, Math.PI * 2);
      ctx.stroke();
    }

    // a bright lip around the opening, so the edge is somewhere definite
    ctx.strokeStyle = 'rgba(238,214,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 17, 10, 0, 0, Math.PI * 2);
    ctx.stroke();

    // motes climbing out of it — on sines rather than Math.random(), which at
    // 60Hz is a strobe rather than a drift
    for (let i = 0; i < 7; i++) {
      const k = (t * 0.42 + i / 7) % 1;
      const a = i * 2.39 + t * 0.5;
      const mx = x + Math.cos(a) * (13 - k * 7);
      const my = y - k * 26 + Math.sin(a * 2) * 1.5;
      ctx.fillStyle = `rgba(221,180,255,${(1 - k) * 0.75})`;
      ctx.fillRect(Math.round(mx), Math.round(my), 1, 1 + (i % 2));
    }
    ctx.restore();
  }

  drawLight(ctx, room) {
    switch (this.type) {
      case 'torch': {
        // Two out-of-phase sines instead of Math.random(): a random term
        // re-rolled every frame strobes at 60Hz rather than flickering.
        const f = 0.90 + Math.sin(this.t * 6.7) * 0.055 + Math.sin(this.t * 15.3 + 1.7) * 0.03;
        addLight(ctx, this.x, this.y - 5, 92 * f, 'rgba(255,152,58,ALPHA)', 0.85 * f);
        break;
      }
      case 'nullbyteNest':
        addLight(ctx, this.x, this.y, 46, 'rgba(38,194,71,ALPHA)',
          this.charges > 0 ? 0.5 : 0.16);
        break;
      case 'void':
        // it does not light the room, it eats the light — a thin sour rim only
        addLight(ctx, this.x, this.y, 16, 'rgba(38,194,71,ALPHA)', 0.3);
        break;
      case 'smelter': {
        if (room?.smelter?.burning) {
          const flick = 0.92 + Math.sin(this.t * 5.1) * 0.05 + Math.sin(this.t * 12.9) * 0.03;
          addLight(ctx, this.x, this.y, 88 * flick, 'rgba(255,130,40,ALPHA)', 0.9 * flick);
        } else {
          addLight(ctx, this.x, this.y, 46, 'rgba(220,110,50,ALPHA)', 0.42);
        }
        break;
      }
      case 'coinPile':
        addLight(ctx, this.x, this.y, 40, 'rgba(240,204,90,ALPHA)', 0.42);
        break;
      case 'coral': {
        // slow breathing glow rather than a flicker — coral is not on fire
        const b = 0.62 + Math.sin(this.t * 1.3) * 0.07;
        addLight(ctx, this.x, this.y - 2, 96 * b, 'rgba(236,120,150,ALPHA)', b);
        addLight(ctx, this.x, this.y - 2, 34, 'rgba(255,190,205,ALPHA)', 0.5);
        break;
      }
      case 'kelp':
        addLight(ctx, this.x, this.y, 34, 'rgba(92,143,90,ALPHA)', 0.24);
        break;
      case 'shelf':
        addLight(ctx, this.x, this.y, 76, 'rgba(165,135,215,ALPHA)', 0.42);
        break;
      case 'chest':
        addLight(ctx, this.x, this.y, 40, 'rgba(220,180,110,ALPHA)', 0.38);
        break;
      case 'anvil':
        addLight(ctx, this.x, this.y, 38, 'rgba(170,190,220,ALPHA)', 0.34);
        break;
      case 'portal': {
        const b = 0.7 + Math.sin(this.t * 2.3) * 0.1;
        addLight(ctx, this.x, this.y, 120 * b, 'rgba(150,92,215,ALPHA)', b * 0.8);
        break;
      }
      case 'merchant':
        // the lantern is his light; the robe only catches a little of it
        addLight(ctx, this.x - 6, this.y + 1, 74, 'rgba(255,186,86,ALPHA)', 0.8);
        addLight(ctx, this.x + 2, this.y - 2, 24, 'rgba(190,140,235,ALPHA)', 0.22);
        break;
      case 'nest':
        addLight(ctx, this.x, this.y, 44, 'rgba(168,102,224,ALPHA)', 0.55);
        break;
    }
  }
}
