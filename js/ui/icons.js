// Shared helper: paint an item's pixel icon into a small DOM canvas.

import { decode } from '../engine/sprite.js';
import { ITEMS } from '../data/sprites.js';

const SPR = {};
for (const id in ITEMS) SPR[id] = decode(ITEMS[id][0], 'item:' + id);

export function iconCanvas(id, size = 12) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const s = SPR[id];
  if (s) x.drawImage(s, (size - s.width) / 2 | 0, (size - s.height) / 2 | 0);
  return c;
}

export function paintIcon(canvas, id) {
  const x = canvas.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, canvas.width, canvas.height);
  const s = SPR[id];
  if (s) x.drawImage(s, ((canvas.width - s.width) / 2) | 0, ((canvas.height - s.height) / 2) | 0);
}

export function spriteFor(id) { return SPR[id]; }
