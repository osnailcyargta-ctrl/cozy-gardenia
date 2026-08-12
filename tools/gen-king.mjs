// Builds the Dragon King's `sleep` and `waking` frames out of the idle frame
// that already exists.
//
// Redrawing a 56x40 dragon from scratch twice would not match the one already
// in the game — the two poses have to be the *same* animal. So the neck is
// bent instead: every column past the shoulder drops by a little more than the
// one before it, which curves the head to the floor without breaking it off
// the body. Then the eye is shut and the jaw is closed.

import { KING } from '../js/data/sprites.js';

const SRC = KING.idle[0];
const W = SRC[0].length, H = SRC.length;

const grid = (rows) => rows.map((r) => r.split(''));
const rows = (g) => g.map((r) => r.join(''));

/**
 * Bend everything above `seam` downward, by an amount that ramps in from
 * `startCol` to the snout.
 */
function bendNeck(g, { startCol = 32, maxDrop = 10, seam = 18, power = 1.5 }) {
  const out = Array.from({ length: H }, () => new Array(W).fill('.'));

  for (let x = 0; x < W; x++) {
    const k = Math.max(0, Math.min(1, (x - startCol) / (W - 1 - startCol)));
    const drop = Math.round(Math.pow(k, power) * maxDrop);
    for (let y = 0; y < H; y++) {
      const ch = g[y][x];
      if (ch === '.') continue;
      // only the head/neck band travels; the shoulders and body stay put
      const ny = y < seam ? y + drop : y;
      if (ny >= 0 && ny < H) out[ny][x] = ch;
    }
  }
  return out;
}

/** Fill the sliver of sky the bend opens up between neck and back. */
function knitSeam(g, { startCol = 32, seam = 18 }) {
  for (let x = startCol; x < W; x++) {
    let top = -1, bottom = -1;
    for (let y = 0; y < H; y++) if (g[y][x] !== '.') { top = y; break; }
    for (let y = H - 1; y >= 0; y--) if (g[y][x] !== '.') { bottom = y; break; }
    if (top < 0) continue;
    for (let y = top; y <= bottom; y++) {
      if (g[y][x] !== '.') continue;
      // borrow the shade from whichever neighbour is nearer
      const above = g[y - 1]?.[x], below = g[y + 1]?.[x];
      g[y][x] = (above && above !== '.') ? above : (below && below !== '.' ? below : '.');
    }
  }
  return g;
}

/**
 * Shut the mouth.
 *
 * This dragon has no drawn eye — the bright marks on the skull are a row of
 * teeth, written as alternating 'j' and 'n'. So "asleep" is a closed jaw, and
 * that means dulling every hot pixel in the head box rather than hunting for
 * an eye that was never there.
 */
function dimMouth(g, { lit = 0 }) {
  const swap = lit
    ? { j: 'i', n: 'l' }          // half-open: still glinting, no longer bright
    : { j: 'h', n: 'k' };         // shut
  for (let y = 6; y < 20; y++) {
    for (let x = 38; x < W; x++) {
      const ch = g[y]?.[x];
      if (swap[ch]) g[y][x] = swap[ch];
    }
  }
  return g;
}

/**
 * Fold the wings by cropping the spikes down from their tips. Dropping the
 * whole fan a few pixels barely changes the silhouette; shortening it does.
 */
function foldWings(g, { fold = 0, cols = [5, 34] }) {
  if (!fold) return g;
  for (let x = cols[0]; x <= cols[1]; x++) {
    let top = -1;
    for (let y = 0; y < H; y++) if (g[y][x] !== '.') { top = y; break; }
    if (top < 0 || top > 16) continue;      // only actual raised spikes
    for (let i = 0; i < fold && top + i < H; i++) g[top + i][x] = '.';
  }
  return g;
}

function build(opts) {
  let g = grid(SRC);
  g = dimMouth(g, opts);        // before the bend, so the box is easy to reason about
  g = foldWings(g, opts);
  g = bendNeck(g, opts);
  g = knitSeam(g, opts);
  return rows(g);
}

const frames = {
  sleep:  build({ startCol: 30, maxDrop: 12, seam: 19, power: 1.4, lit: 0, fold: 5 }),
  waking: build({ startCol: 30, maxDrop: 5,  seam: 19, power: 1.4, lit: 1, fold: 2 }),
};

const which = process.argv[2];
if (which === 'js') {
  for (const k in frames) {
    console.log(`// ${k}\n[\n${frames[k].map((r) => `      '${r}',`).join('\n')}\n],`);
  }
} else {
  for (const k in frames) {
    console.log(`${k}: ${frames[k][0].length}x${frames[k].length}`);
  }
}
