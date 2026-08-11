// Static room furniture. Interactive props expose `interact` and a prompt label;
// decorative ones just draw and emit light.

import { decode, draw } from '../engine/sprite.js';
import { BLOCKS } from '../data/sprites.js';
import { addLight } from '../engine/postfx.js';
import * as P from '../engine/particles.js';

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
};

export class Prop {
  constructor(type, x, y) {
    this.type = type;
    this.x = x; this.y = y;
    this.t = Math.random() * 10;
    this.dead = false;
    this.opened = false;

    const box = {
      smelter:  [8, 8,  true,  'Smelter'],
      chest:    [8, 6,  true,  'Chest'],
      anvil:    [8, 6,  true,  'Anvil'],
      shelf:    [30, 22, true, 'Shelf'],
      torch:    [0, 0,  false, null],
      coinPile: [8, 4,  true,  null],
    }[type] || [8, 8, true, null];

    this.hw = box[0];
    this.hh = box[1];
    this.solid = box[2];
    this.label = box[3];
    this.interactive = !!this.label;

    // The shelf is the library's one hero object; at 1x it reads as a trinket
    // lost in the room rather than the thing the whole hub is built around.
    this.scale = type === 'shelf' ? 2 : 1;

    // Interaction reach, measured to the prop's box. Generous on purpose: with
    // no on-screen prompt telling you when you are in range, a tight radius
    // reads as "E is broken" rather than "stand closer".
    this.reach = type === 'shelf' ? 34 : 26;
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
      case 'torch':   return Math.floor(this.t * 6.5) % 2 ? S.torch1 : S.torch0;
    }
    return S.anvil;
  }

  draw(ctx, room) {
    const spr = this.sprite(room);

    if (this.type !== 'torch') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(Math.round(this.x), Math.round(this.y + this.hh - 1),
        this.hw * 0.85, 2.6 * this.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    draw(ctx, spr, this.x, this.y, { scale: this.scale });

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

  drawLight(ctx, room) {
    switch (this.type) {
      case 'torch': {
        // Two out-of-phase sines instead of Math.random(): a random term
        // re-rolled every frame strobes at 60Hz rather than flickering.
        const f = 0.90 + Math.sin(this.t * 6.7) * 0.055 + Math.sin(this.t * 15.3 + 1.7) * 0.03;
        addLight(ctx, this.x, this.y - 5, 92 * f, 'rgba(255,152,58,ALPHA)', 0.85 * f);
        break;
      }
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
      case 'shelf':
        addLight(ctx, this.x, this.y, 76, 'rgba(165,135,215,ALPHA)', 0.42);
        break;
      case 'chest':
        addLight(ctx, this.x, this.y, 40, 'rgba(220,180,110,ALPHA)', 0.38);
        break;
      case 'anvil':
        addLight(ctx, this.x, this.y, 38, 'rgba(170,190,220,ALPHA)', 0.34);
        break;
    }
  }
}
