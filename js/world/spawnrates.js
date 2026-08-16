// Per-depth spawn and rate overrides for the generated book.
//
// Most depths use the plain curve out of dungeon.js. A few carry adjustments
// that depend on what the player has done in the room rather than on the depth
// alone, which is why they live here instead of in the generator: the generator
// runs once when a room is built, and these are evaluated while it is being
// played.

import { VW, VH, TILE } from '../engine/canvas.js';

/** Vendor interactions, keyed by depth. Cleared whenever a run restarts. */
const vendorVisits = new Map();

const OVERRIDE_DEPTH = 10;
const OVERRIDE_THRESHOLD = 3;

/**
 * Tiles the override region covers, as [tx, ty]. Two on the left wall and one
 * on the top, meeting at the corner.
 */
const REGION = [[0, 2], [0, 3], [1, 1]];

export function resetRates() { vendorVisits.clear(); }

export function noteVendorVisit(depth) {
  vendorVisits.set(depth, (vendorVisits.get(depth) || 0) + 1);
}

function overrideActive(depth) {
  return depth === OVERRIDE_DEPTH
    && (vendorVisits.get(depth) || 0) >= OVERRIDE_THRESHOLD;
}

/**
 * Called every frame while a generated room is being played. Opens the override
 * region on the tilemap once its conditions are met, and reports when the player
 * has entered it.
 */
export function applyRates(room, depth, player) {
  if (!overrideActive(depth)) return false;

  if (!room.map.rateOpen) {
    room.map.rateOpen = new Set(REGION.map(([tx, ty]) => ty * room.map.w + tx));
  }

  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  return room.map.rateOpen.has(py * room.map.w + px);
}

/* ------------------------------------------------------------------ */

const W = 30, H = 16;

function slab() {
  const rows = [];
  for (let y = 0; y < H; y++) {
    if (y < 2 || y >= H - 2) { rows.push('#'.repeat(W)); continue; }
    rows.push('#' + '.'.repeat(W - 2) + '#');
  }
  return rows;
}

/**
 * The layout used when the override region is entered. Fully enclosed: it has
 * no exit tile and no back tile, so nothing in the room-transition code will
 * ever move you out of it.
 */
export const OVERRIDE_ROOM = {
  id: 'rate-override',
  name: '',
  tiles: slab(),
  spawn: { x: VW / 2, y: VH - 64 },
  spawnBack: { x: VW / 2, y: VH - 64 },
  mood: { fog: 0.9, vignette: 1.6, ambient: '#000000' },
  floor: 'null',
  props: [
    {
      type: 'chest',
      x: VW / 2,
      y: VH / 2,
      title: 'hope you enjoy this:)',
      contents: {
        0: { id: 'gold_coin', count: 10 },
        1: { id: 'reforge_coupon', count: 2 },
      },
    },
  ],
  gate: null,
  enemies: [],
  exitTo: null,
  backTo: null,
};
