// The Portal Gun, and the hole it opens.
//
// Left click puts a portal on the floor and asks for four numbers: book, room,
// and a tile. Walk into it and you come out there.
//
// The coordinate system is the tilemap's own, stated plainly because it is the
// thing everyone gets wrong: **x and y are TILES, (0, 0) is the top-left corner
// of the room, and y counts DOWNWARD.** y + 1 is one tile lower on the screen,
// not one higher.

import { addLight } from '../engine/postfx.js';
import { TILE } from '../engine/canvas.js';
import * as P from '../engine/particles.js';
import { sfx } from '../engine/audio.js';

/** Tile coordinates -> the pixel centre of that tile. */
export function tileCentre(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

/**
 * Read "1 3 0 0" into a destination. Accepts any run of separators so "1,3,0,0"
 * and "1 3 0 0" both work. Returns null when it is not four numbers.
 */
export function parseDestination(text) {
  const n = String(text || '').trim().split(/[^0-9-]+/).filter((s) => s !== '').map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [book, room, tx, ty] = n;
  return { book: book - 1, room: room - 1, tx, ty };
}

export class Portal {
  constructor(x, y, dest) {
    this.x = x; this.y = y;
    this.dest = dest;
    this.t = 0;
    this.dead = false;
    this.used = false;
    this.open = 0;            // 0..1, how far it has irised open
    sfx.unlock();
  }

  update(dt, player) {
    this.t += dt;
    this.open = Math.min(1, this.open + dt * 3.2);

    if (Math.random() > 0.35) {
      const a = Math.random() * Math.PI * 2;
      const r = 14 + Math.random() * 10;
      P.spawn({
        x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r * 0.6,
        vx: -Math.cos(a) * 40, vy: -Math.sin(a) * 26,
        life: 0.5, size: 2, colour: Math.random() > 0.5 ? '#f0a020' : '#ffd98a',
        drag: 0.94, glow: 9, glowColour: 'rgba(240,160,32,ALPHA)',
      });
    }

    if (!this.used && this.open >= 1
        && Math.hypot(player.x - this.x, player.y - this.y) < 11) {
      this.used = true;
      return true;
    }
    return false;
  }

  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    const k = this.open * this.open * (3 - 2 * this.open);
    const rx = 11 * k, ry = 7 * k;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 3; i >= 0; i--) {
      const f = 1 - i * 0.22;
      ctx.strokeStyle = `rgba(240,160,32,${0.24 * f})`;
      ctx.lineWidth = 1 + i;
      ctx.beginPath();
      ctx.ellipse(x, y, rx + i * 1.6, ry + i, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, rx));
    g.addColorStop(0, 'rgba(255,240,200,0.95)');
    g.addColorStop(0.55, 'rgba(240,160,32,0.5)');
    g.addColorStop(1, 'rgba(240,160,32,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // a slow swirl inside it
    ctx.strokeStyle = 'rgba(255,232,180,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * Math.PI * 4 + this.t * 2.4;
      const rr = (i / 26) * rx;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr * (ry / Math.max(1, rx));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawLight(ctx) {
    addLight(ctx, this.x, this.y, 46 * this.open, 'rgba(240,160,32,ALPHA)', 0.7);
  }
}
