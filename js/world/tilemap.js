// Tile rendering. The floor and walls never change during a room, so the whole
// map is baked to an offscreen canvas once on load and blitted each frame. That
// buys us the budget to draw real per-tile detail — cracks, mortar, wear — which
// is what stops a tiled floor from reading as flat wallpaper.

import { TILE, VW, VH } from '../engine/canvas.js';

/** Deterministic per-tile noise so the detail is stable frame to frame. */
function hash(x, y, seed = 0) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export function isSolidChar(c) { return c === '#'; }

export class TileMap {
  constructor(rows, floorStyle = 'stone') {
    this.rows = rows;
    this.h = rows.length;
    this.w = rows[0].length;
    this.floorStyle = floorStyle;
    this.baked = null;
  }

  at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return '#';
    return this.rows[ty][tx];
  }

  solidAt(tx, ty) { return isSolidChar(this.at(tx, ty)); }

  /** Solid test in pixel space. */
  solidPx(px, py) {
    return this.solidAt(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  exitAt(px, py) {
    return this.at(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  bake() {
    const c = document.createElement('canvas');
    c.width = VW; c.height = VH;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;

    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const ch = this.at(tx, ty);
        if (isSolidChar(ch)) this.drawWall(x, tx, ty);
        else this.drawFloor(x, tx, ty);
      }
    }

    // Contact shadow under every wall that sits above open floor — the single
    // cheapest trick for making a flat top-down room read as having depth.
    for (let ty = 0; ty < this.h - 1; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        if (!this.solidAt(tx, ty) || this.solidAt(tx, ty + 1)) continue;
        const g = x.createLinearGradient(0, (ty + 1) * TILE, 0, (ty + 1) * TILE + 10);
        g.addColorStop(0, 'rgba(0,0,0,0.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.fillRect(tx * TILE, (ty + 1) * TILE, TILE, 10);
      }
    }

    this.baked = c;
    return c;
  }

  drawFloor(x, tx, ty) {
    const px = tx * TILE, py = ty * TILE;
    const wood = this.floorStyle === 'wood';
    const water = this.floorStyle === 'water';
    const n = hash(tx, ty, 1);

    if (water) {
      // Flooded flagstones. The stone stays readable underneath — a flat sheet
      // of blue leaves the room with no architecture at all. The caustics are
      // deliberately NOT tile-aligned: a highlight that repeats on every tile
      // boundary turns the floor back into visible graph paper.
      const shades = ['#0c2b37', '#0b2833', '#0e2f3c', '#0a2530'];
      x.fillStyle = shades[((tx * 7 + ty * 13) >>> 0) % 4];
      x.fillRect(px, py, TILE, TILE);

      x.fillStyle = 'rgba(0,0,0,0.34)';
      x.fillRect(px, py + TILE - 1, TILE, 1);
      x.fillRect(px + TILE - 1, py, 1, TILE);

      for (let i = 0; i < 3; i++) {
        const h = hash(tx * 3 + i, ty * 5 + i, 11);
        if (h < 0.42) continue;
        const cy = (h * TILE) | 0;
        // a band drawn from a continuous wave, so it crosses tile seams
        const phase = Math.sin((px + cy * 2) * 0.09 + ty) * 5;
        x.fillStyle = `rgba(112,218,212,${0.05 + h * 0.06})`;
        x.fillRect(px + (((phase + 16) | 0) % TILE) - 3, py + cy, 5 + ((h * 6) | 0), 1);
      }
      if (n < 0.14) {
        x.fillStyle = 'rgba(44,86,56,0.3)';   // weed in the joints
        x.fillRect(px + 2, py + TILE - 4, 4, 3);
      }
      return;
    }

    if (wood) {
      // planks running horizontally, 4px tall, with staggered joints
      const base = ['#3a2a1c', '#42301f', '#372718', '#3f2d1d'][(ty * 3 + tx) % 4];
      x.fillStyle = base;
      x.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 4; i++) {
        const yy = py + i * 4;
        x.fillStyle = `rgba(0,0,0,${0.16 + hash(tx, ty * 4 + i, 3) * 0.12})`;
        x.fillRect(px, yy + 3, TILE, 1);
        // grain
        if (hash(tx, ty * 4 + i, 7) > 0.6) {
          x.fillStyle = 'rgba(140,105,64,0.13)';
          x.fillRect(px + ((hash(tx, i, 9) * 12) | 0), yy + 1, 4, 1);
        }
      }
      // plank end joints
      if (n > 0.55) {
        x.fillStyle = 'rgba(0,0,0,0.3)';
        x.fillRect(px + ((n * 12) | 0), py, 1, TILE);
      }
    } else {
      // Flagstones. The shade variation is deliberately narrow — a wide random
      // spread reads as a patchy quilt rather than worn stone.
      const shades = ['#39304b', '#352c46', '#3d3450', '#332a44'];
      x.fillStyle = shades[((tx * 7 + ty * 13) >>> 0) % 4];
      x.fillRect(px, py, TILE, TILE);

      x.fillStyle = 'rgba(0,0,0,0.42)';
      x.fillRect(px, py + TILE - 1, TILE, 1);
      x.fillRect(px + TILE - 1, py, 1, TILE);
      x.fillStyle = 'rgba(160,140,190,0.10)';
      x.fillRect(px, py, TILE - 1, 1);
      x.fillRect(px, py, 1, TILE - 1);

      // wear: chips and cracks on a minority of tiles
      if (n > 0.78) {
        x.fillStyle = 'rgba(0,0,0,0.3)';
        const cx = px + 3 + ((hash(tx, ty, 4) * 9) | 0);
        const cy = py + 3 + ((hash(tx, ty, 5) * 9) | 0);
        x.fillRect(cx, cy, 2, 1);
        x.fillRect(cx + 2, cy + 1, 1, 2);
      } else if (n < 0.12) {
        x.fillStyle = 'rgba(150,130,180,0.05)';
        x.fillRect(px + 4, py + 5, 7, 5);
      }
    }
  }

  drawWall(x, tx, ty) {
    const px = tx * TILE, py = ty * TILE;
    const openBelow = !this.solidAt(tx, ty + 1);
    const n = hash(tx, ty, 2);
    const wet = this.floorStyle === 'water';

    // Base block, deliberately far darker than the floor. Without a clear
    // value gap between wall and floor the room has no readable architecture —
    // it just looks like one flat texture with props sitting on it.
    x.fillStyle = ['#100d19', '#141020', '#0d0a15'][((tx * 5 + ty * 3) >>> 0) % 3];
    x.fillRect(px, py, TILE, TILE);

    // brick courses, offset every other row
    const off = (ty % 2) * 8;
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.fillRect(px, py + TILE - 1, TILE, 1);
    x.fillRect(px + ((off + 7) % TILE), py, 1, TILE);

    // faint mortar catching light on the upper edge of each brick
    const mortar = wet ? '110,180,190' : '110,92,132';
    x.fillStyle = `rgba(${mortar},0.14)`;
    x.fillRect(px, py, TILE, 1);
    if (n > 0.7) {
      x.fillStyle = `rgba(${mortar},0.09)`;
      x.fillRect(px + 2, py + 3, 5, 1);
    }
    if (n < 0.2) {
      x.fillStyle = 'rgba(0,0,0,0.3)';
      x.fillRect(px + 9, py + 8, 4, 3);
    }

    // moss creeping out of the joints, only near the floor line
    if (openBelow && n > 0.62) {
      x.fillStyle = 'rgba(61,90,68,0.3)';
      x.fillRect(px + ((n * 10) | 0), py + TILE - 3, 3, 2);
    }

    // Lit lip where the wall face meets open floor — this single band is what
    // sells the wall as a vertical surface rather than a dark floor tile. The
    // per-tile jitter keeps it from looking like a ruled line.
    if (openBelow) {
      x.fillStyle = wet ? '#1c4351' : '#3b3050';
      x.fillRect(px, py + TILE - 3, TILE, 3);
      x.fillStyle = wet ? '#2d6879' : '#5b4a76';
      x.fillRect(px, py + TILE - 3, TILE, 1);
      if (n > 0.45) {
        x.fillStyle = wet ? 'rgba(112,218,212,0.42)' : 'rgba(140,118,175,0.5)';
        x.fillRect(px + ((n * 8) | 0), py + TILE - 3, 4, 1);
      }
      // waterline scum just under the lip
      if (wet && n > 0.3) {
        x.fillStyle = 'rgba(44,86,56,0.35)';
        x.fillRect(px + ((n * 9) | 0), py + TILE - 1, 5, 1);
      }
    }
  }
}
